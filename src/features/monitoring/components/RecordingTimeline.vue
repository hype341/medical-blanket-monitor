<template>
  <section class="recording-timeline">
    <header>
      <div>
        <h3>录像回放</h3>
        <p>滚动保留最近 {{ retentionMinutes }} 分钟，旧片段到期后自动清理。</p>
      </div>
      <div class="recording-timeline__controls">
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
        @click="emit('seek', segment.startAt)"
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
import { pruneExpiredSegments } from "../recording";

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
const cursorPercent = ref(100);
const isScrubbing = ref(false);
let clockTimer: ReturnType<typeof setInterval> | null = null;

const windowStart = computed(() => now.value - props.retentionMinutes * 60_000);
const windowSpan = computed(() => now.value - windowStart.value);
const visibleSegments = computed(() =>
  pruneExpiredSegments(props.segments, new Date(now.value).toISOString(), props.retentionMinutes),
);
const visibleAlarms = computed(() =>
  props.alarms.filter((alarm) => new Date(alarm.occurredAt).getTime() >= windowStart.value),
);

const cursorTime = computed(() =>
  formatDateTime(new Date(windowStart.value + (cursorPercent.value / 100) * windowSpan.value)),
);
const windowStartLabel = computed(() => formatTime(new Date(windowStart.value).toISOString()));
const windowEndLabel = computed(() => formatTime(new Date(now.value).toISOString()));

const positionedSegments = computed(() =>
  visibleSegments.value.map((segment) => {
    const start = Math.max(new Date(segment.startAt).getTime(), windowStart.value);
    const end = Math.min(new Date(segment.endAt).getTime(), now.value);
    return {
      ...segment,
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

function shiftCursor(seconds: number): void {
  cursorPercent.value = Math.min(
    100,
    Math.max(0, cursorPercent.value + (seconds / (props.retentionMinutes * 60)) * 100),
  );
  commitSeek();
}

function commitSeek(): void {
  isScrubbing.value = false;
  emit(
    "seek",
    new Date(windowStart.value + (cursorPercent.value / 100) * windowSpan.value).toISOString(),
  );
}

function syncCursor(): void {
  if (!props.currentAt) {
    cursorPercent.value = 100;
    return;
  }
  const target = new Date(props.currentAt).getTime();
  cursorPercent.value = Math.min(
    100,
    Math.max(0, ((target - windowStart.value) / windowSpan.value) * 100),
  );
}

watch(() => props.currentAt, syncCursor, { immediate: true });

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = Date.now();
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
}
</style>
