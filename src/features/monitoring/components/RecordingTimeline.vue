<template>
  <section class="recording-timeline">
    <header>
      <div>
        <h3>录像回放</h3>
        <p>
          滚动保留最近 {{ retentionMinutes }} 分钟；当前录像最多约 15 秒后进入回放。
        </p>
      </div>
      <div class="recording-timeline__controls">
        <button
          v-for="minutes in availableWindows"
          :key="minutes"
          type="button"
          :class="{ 'is-active': timelineWindowMinutes === minutes }"
          @click="setTimelineWindow(minutes)"
        >
          {{ windowLabel(minutes) }}
        </button>
        <span class="recording-timeline__divider" />
        <button
          type="button"
          aria-label="向前回看 10 秒"
          :disabled="!visibleSegments.length"
          @click="shiftCursor(-10)"
        >
          −10s
        </button>
        <span>拖动松手定位</span>
        <button
          type="button"
          aria-label="向后查看 10 秒"
          :disabled="!visibleSegments.length"
          @click="shiftCursor(10)"
        >
          +10s
        </button>
      </div>
    </header>

    <form class="recording-timeline__jump" @submit.prevent="seekToInputTime">
      <label>
        <span>按时间定位</span>
        <input
          v-model="jumpValue"
          type="datetime-local"
          step="1"
          :min="jumpMin"
          :max="jumpMax"
          aria-label="按时间定位回放"
          @input="jumpDirty = true"
        />
      </label>
      <button type="submit" :disabled="!visibleSegments.length">回放此时间</button>
      <small :data-error="Boolean(jumpError)">
        {{ jumpError || "支持精确到秒，范围以实际录像片段为准" }}
      </small>
    </form>

    <div class="recording-timeline__clock">
      <span>{{ windowStartLabel }}</span>
      <strong>{{ cursorTime }}</strong>
      <span>{{ windowEndLabel }}</span>
    </div>

    <div class="recording-timeline__rail" :data-empty="!visibleSegments.length">
      <button
        v-for="segment in positionedSegments"
        :key="segment.id"
        type="button"
        class="recording-timeline__segment"
        :style="{ left: `${segment.left}%`, width: `${segment.width}%` }"
        :title="`${formatTime(segment.startAt)} - ${formatTime(segment.endAt)}`"
        :data-start-at="segment.visibleStartAt"
        :data-end-at="segment.endAt"
        @click="emit('seek', segment.visibleStartAt)"
      />
      <button
        v-for="alarm in positionedAlarms"
        :key="alarm.alarmId"
        type="button"
        class="recording-timeline__alarm"
        :style="{ left: `${alarm.left}%` }"
        :title="`${formatTime(alarm.occurredAt)} ${alarm.title}`"
        @click="emit('select-alarm', alarm)"
      />
      <span class="recording-timeline__cursor" :style="{ left: `${cursorPercent}%` }" />
    </div>

    <input
      v-model.number="cursorPercent"
      class="recording-timeline__range"
      type="range"
      min="0"
      max="100"
      step="0.1"
      :disabled="!visibleSegments.length"
      aria-label="录像回放进度"
      @pointerdown="isScrubbing = true"
      @input="isScrubbing = true"
      @change="commitSeek"
    />

    <div v-if="!visibleSegments.length" class="recording-timeline__empty">
      <strong>暂无录像片段</strong>
      <p>MediaMTX 开始录制并返回分段索引后，时间轴将在这里持续向前推进。</p>
    </div>

    <div v-else class="recording-timeline__legend">
      <span>
        回放位置
        <strong>{{ cursorTime }}</strong>
      </span>
      <span>片段自动预加载 · 红色告警点可定位</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { AlarmEnvelope, RecordingSegment } from "../recording";
import { findPlaybackSegment, pruneExpiredSegments } from "../recording";

const props = withDefaults(
  defineProps<{
    segments?: RecordingSegment[];
    alarms?: AlarmEnvelope[];
    retentionMinutes?: number;
    currentAt?: string;
  }>(),
  {
    segments: () => [],
    alarms: () => [],
    retentionMinutes: 30,
    currentAt: "",
  },
);

const emit = defineEmits<{
  seek: [targetAt: string];
  "select-alarm": [alarm: AlarmEnvelope];
}>();

const now = ref(Date.now());
const windowEndAt = ref(Date.now());
const cursorPercent = ref(100);
const isScrubbing = ref(false);
const jumpDirty = ref(false);
const jumpValue = ref(toDateTimeLocal(Date.now()));
const jumpError = ref("");
const timelineWindowMinutes = ref(Math.min(60, props.retentionMinutes));
let clockTimer: ReturnType<typeof setInterval> | null = null;

const availableWindows = computed(() =>
  [15, 60, 360, 1_440].filter((minutes) => minutes <= props.retentionMinutes),
);
const retentionStart = computed(() => now.value - props.retentionMinutes * 60_000);
const windowStart = computed(() => windowEndAt.value - timelineWindowMinutes.value * 60_000);
const windowSpan = computed(() => windowEndAt.value - windowStart.value);
const visibleSegments = computed(() =>
  pruneExpiredSegments(
    props.segments,
    new Date(now.value).toISOString(),
    props.retentionMinutes,
  ).filter((segment) => new Date(segment.endAt).getTime() >= windowStart.value),
);
const visibleAlarms = computed(() =>
  props.alarms.filter((alarm) => new Date(alarm.occurredAt).getTime() >= windowStart.value),
);

const cursorTime = computed(() =>
  formatDateTime(new Date(windowStart.value + (cursorPercent.value / 100) * windowSpan.value)),
);
const windowStartLabel = computed(() => formatTime(new Date(windowStart.value).toISOString()));
const windowEndLabel = computed(() => formatTime(new Date(windowEndAt.value).toISOString()));
const jumpMin = computed(() => toDateTimeLocal(retentionStart.value));
const jumpMax = computed(() => toDateTimeLocal(now.value));

const positionedSegments = computed(() =>
  visibleSegments.value.map((segment) => {
    const start = Math.max(new Date(segment.startAt).getTime(), windowStart.value);
    const end = Math.min(new Date(segment.endAt).getTime(), windowEndAt.value);
    return {
      ...segment,
      visibleStartAt: new Date(start).toISOString(),
      left: ((start - windowStart.value) / windowSpan.value) * 100,
      width: Math.max(((end - start) / windowSpan.value) * 100, 0.3),
    };
  }),
);

const positionedAlarms = computed(() =>
  visibleAlarms.value.map((alarm) => ({
    ...alarm,
    left: ((new Date(alarm.occurredAt).getTime() - windowStart.value) / windowSpan.value) * 100,
  })),
);

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

function windowLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  if (minutes < 1_440) return `${minutes / 60} 小时`;
  return "24 小时";
}

function shiftCursor(seconds: number): void {
  cursorPercent.value = Math.min(
    100,
    Math.max(0, cursorPercent.value + ((seconds * 1_000) / windowSpan.value) * 100),
  );
  commitSeek();
}

function commitSeek(): void {
  isScrubbing.value = false;
  jumpError.value = "";
  emit(
    "seek",
    new Date(windowStart.value + (cursorPercent.value / 100) * windowSpan.value).toISOString(),
  );
}

function syncCursor(): void {
  if (!props.currentAt) {
    cursorPercent.value = 100;
    if (!jumpDirty.value) jumpValue.value = toDateTimeLocal(now.value);
    return;
  }
  const target = new Date(props.currentAt).getTime();
  if (target < windowStart.value || target > windowEndAt.value) {
    focusWindowAt(target);
  }
  cursorPercent.value = Math.min(
    100,
    Math.max(0, ((target - windowStart.value) / windowSpan.value) * 100),
  );
  if (!jumpDirty.value) jumpValue.value = toDateTimeLocal(target);
}

function focusWindowAt(target: number): void {
  const span = windowSpan.value;
  windowEndAt.value = Math.min(now.value, target + span * 0.82);
}

function setTimelineWindow(minutes: number): void {
  timelineWindowMinutes.value = minutes;
  if (props.currentAt) {
    focusWindowAt(new Date(props.currentAt).getTime());
  } else {
    windowEndAt.value = now.value;
  }
}

function seekToInputTime(): void {
  const target = new Date(jumpValue.value).getTime();
  if (!Number.isFinite(target)) {
    jumpError.value = "请输入有效的日期和时间";
    return;
  }
  if (target < retentionStart.value || target > now.value) {
    jumpError.value = "该时间不在当前录像保留范围内";
    return;
  }
  const targetAt = new Date(target).toISOString();
  if (!findPlaybackSegment(props.segments, targetAt, 2_000)) {
    jumpError.value = "该时间没有对应录像片段，请换个时间";
    return;
  }

  if (target < windowStart.value) {
    timelineWindowMinutes.value = props.retentionMinutes;
  }
  if (target < windowStart.value || target > windowEndAt.value) {
    focusWindowAt(target);
  }
  jumpError.value = "";
  cursorPercent.value = ((target - windowStart.value) / windowSpan.value) * 100;
  jumpDirty.value = false;
  emit("seek", targetAt);
}

function toDateTimeLocal(value: number): string {
  const local = new Date(value - new Date(value).getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 19);
}

watch(() => props.currentAt, syncCursor, { immediate: true });

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = Date.now();
    if (!props.currentAt && !isScrubbing.value) windowEndAt.value = now.value;
    if (!isScrubbing.value) syncCursor();
  }, 1000);
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<style scoped lang="scss">
.recording-timeline {
  padding: 16px;
  margin-top: 14px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 650;
    }

    p {
      margin: 4px 0 0;
      font-size: 10px;
      color: #7c8d88;
    }
  }
}

.recording-timeline__controls {
  display: flex;
  gap: 5px;
  align-items: center;

  > span {
    padding: 0 3px;
    font-size: 9px;
    color: #879690;
    white-space: nowrap;
  }

  button {
    min-width: 42px;
    padding: 5px 7px;
    font-size: 9px;
    color: #35695e;
    cursor: pointer;
    background: #f7fbf9;
    border: 1px solid #cdded8;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    &:focus-visible {
      outline: 2px solid #2f806a;
      outline-offset: 2px;
    }

    &.is-active {
      color: #fff;
      background: #2f806a;
      border-color: #2f806a;
    }
  }
}

.recording-timeline__divider {
  width: 1px;
  height: 17px;
  padding: 0 !important;
  margin: 0 2px;
  background: #d6e3de;
}

.recording-timeline__jump {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 10px;
  margin-top: 13px;
  background: #f5f9f7;
  border: 1px solid #dce7e3;

  label {
    display: flex;
    gap: 7px;
    align-items: center;

    span {
      font-size: 9px;
      font-weight: 650;
      color: #527068;
      white-space: nowrap;
    }
  }

  input {
    min-width: 190px;
    height: 30px;
    padding: 0 8px;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: 10px;
    color: #245d51;
    background: #fff;
    border: 1px solid #c8dad4;

    &:focus {
      outline: 2px solid #2f806a;
      outline-offset: 1px;
    }
  }

  button {
    height: 30px;
    padding: 0 10px;
    font-size: 9px;
    font-weight: 650;
    color: #fff;
    cursor: pointer;
    background: #2f806a;
    border: 1px solid #2f806a;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    &:focus-visible {
      outline: 2px solid #174e46;
      outline-offset: 2px;
    }
  }

  small {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 9px;
    color: #82918d;
    white-space: nowrap;

    &[data-error="true"] {
      color: #a53d34;
    }
  }
}

.recording-timeline__clock {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
  font-family: "Avenir Next", sans-serif;
  font-size: 9px;
  color: #7d8e89;

  strong {
    font-size: 12px;
    color: #2b6559;
  }
}

.recording-timeline__rail {
  position: relative;
  height: 34px;
  margin-top: 6px;
  overflow: hidden;
  background:
    repeating-linear-gradient(90deg, transparent 0 47px, rgb(23 60 58 / 7%) 47px 48px), #f3f7f5;
  border: 1px solid #dbe7e3;
}

.recording-timeline__segment {
  position: absolute;
  top: 10px;
  min-width: 2px;
  height: 13px;
  cursor: pointer;
  background: #65a28f;
  border: 0;
  opacity: 0.72;
}

.recording-timeline__alarm {
  position: absolute;
  top: 3px;
  z-index: 2;
  width: 7px;
  height: 25px;
  padding: 0;
  cursor: pointer;
  background: #c84a3f;
  border: 0;
  border-radius: 1px;
  transform: translateX(-50%);
}

.recording-timeline__cursor {
  position: absolute;
  top: 0;
  z-index: 3;
  width: 1px;
  height: 100%;
  background: #103f3a;
  box-shadow: 0 0 0 1px rgb(16 63 58 / 14%);
}

.recording-timeline__range {
  width: 100%;
  margin: 8px 0 0;
  accent-color: #2f806a;
}

.recording-timeline__empty {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 10px 12px;
  margin-top: 8px;
  background: #fafcfb;
  border-left: 3px solid #c7d8d2;

  strong {
    font-size: 11px;
    color: #526e66;
    white-space: nowrap;
  }

  p {
    margin: 0;
    font-size: 10px;
    color: #81918c;
  }
}

.recording-timeline__legend {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 9px;
  color: #7c8d88;

  strong {
    color: #2b6559;
  }
}

@media (width <= 600px) {
  .recording-timeline > header {
    flex-direction: column;
  }

  .recording-timeline__jump {
    grid-template-columns: 1fr auto;

    label {
      grid-column: 1 / -1;
      justify-content: space-between;
    }

    input {
      flex: 1;
      min-width: 0;
    }

    small {
      grid-column: 1 / -1;
      white-space: normal;
    }
  }
}
</style>
