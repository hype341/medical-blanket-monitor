<template>
  <section class="alarm-timeline">
    <header>
      <div>
        <span class="alarm-timeline__eyebrow">病房级独立告警</span>
        <h3>病房告警</h3>
        <p>每间病房使用独立 Topic，报文中的床位编号用于定位。</p>
      </div>
      <span class="alarm-timeline__count" :data-active="unresolvedCount > 0">
        {{ unresolvedCount > 0 ? `${unresolvedCount} 条待处理` : "当前平稳" }}
      </span>
    </header>

    <ol v-if="alarms.length" class="alarm-timeline__list">
      <li
        v-for="alarm in alarms"
        :key="alarm.alarmId"
        :data-level="alarm.level"
        :data-status="alarm.status"
      >
        <div class="alarm-timeline__meta">
          <span class="alarm-timeline__state">
            <i aria-hidden="true" />
            {{ alarm.status === "RESOLVED" ? "已解决" : levelLabel(alarm.level) }}
          </span>
          <time :datetime="alarm.occurredAt">{{ formatTime(alarm.occurredAt) }}</time>
        </div>
        <div class="alarm-timeline__content">
          <h4>{{ alarm.title }}</h4>
          <p class="alarm-location">
            <span>{{ locationLabel }}</span>
          </p>
          <small v-if="alarm.resolvedAt">解决于 {{ formatTime(alarm.resolvedAt) }}</small>
        </div>
        <button
          v-if="alarm.status !== 'RESOLVED'"
          type="button"
          @click="emit('resolve', alarm.alarmId)"
        >
          标记已解决
        </button>
      </li>
    </ol>

    <div v-else class="alarm-timeline__empty">
      <span class="alarm-timeline__mark" />
      <div>
        <strong>病房状态平稳</strong>
        <p>收到本病房的独立告警主题后，记录会立即显示在这里。</p>
      </div>
    </div>

    <footer>
      <span>本病房独立告警 Topic</span>
      <code :title="topic || '尚未生成'">{{ topic || "尚未生成" }}</code>
      <small>告警前 30 秒 + 后 60 秒自动剪辑</small>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AlarmEnvelope, AlarmLevel } from "../recording";

const props = withDefaults(
  defineProps<{
    alarms?: AlarmEnvelope[];
    locationLabel?: string;
    topic?: string;
  }>(),
  {
    alarms: () => [],
    locationLabel: "",
    topic: "",
  },
);

const emit = defineEmits<{
  resolve: [alarmId: string];
}>();

const unresolvedCount = computed(
  () => props.alarms.filter((alarm) => alarm.status !== "RESOLVED").length,
);

function levelLabel(level: AlarmLevel): string {
  return {
    INFO: "提醒",
    WARNING: "待处理",
    CRITICAL: "紧急",
  }[level];
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
</script>

<style scoped lang="scss">
.alarm-timeline {
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

    p,
    span {
      margin: 4px 0 0;
      font-size: 10px;
      color: #7c8d88;
    }
  }
}

.alarm-timeline__list {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 14px 0 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr) auto;
    gap: 10px;
    padding: 9px;
    background: #fff5f3;
    border-left: 3px solid #c84a3f;

    &[data-level="CRITICAL"] {
      background: #ffefed;
      border-left-color: #a7241b;
    }

    &[data-status="RESOLVED"] {
      background: #eff8f3;
      border-left-color: #2f806a;
    }
  }

  time {
    font-family: "Avenir Next", sans-serif;
    font-size: 9px;
    color: #7b6a4d;
  }

  div {
    display: grid;
    gap: 3px;
  }

  strong {
    display: flex;
    gap: 7px;
    align-items: center;
    font-size: 11px;
    font-weight: 650;

    span {
      padding: 2px 5px;
      font-size: 8px;
      font-weight: 600;
      color: #fff;
      background: #c84a3f;
    }
  }

  p,
  small {
    margin: 0;
    font-size: 9px;
    color: #7c8985;
  }

  .alarm-location {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;

    span {
      padding: 3px 6px;
      color: #315f55;
      background: #edf6f2;
      border: 1px solid #c7ddd5;
    }

    small {
      color: #a43d34;
    }
  }

  button {
    align-self: center;
    padding: 4px 7px;
    font-size: 9px;
    color: #a43d34;
    white-space: nowrap;
    cursor: pointer;
    background: #fff;
    border: 1px solid #cfa29c;

    &:focus-visible {
      outline: 2px solid #c84a3f;
      outline-offset: 2px;
    }
  }

  li[data-status="RESOLVED"] {
    strong span {
      background: #2f806a;
    }

    time,
    p,
    small {
      color: #5f7d73;
    }
  }
}

.alarm-timeline__empty {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 13px;
  margin-top: 14px;
  background: #fafcfb;
  border: 1px dashed #d3dfdb;

  div {
    display: grid;
    gap: 4px;
  }

  strong {
    font-size: 11px;
    color: #526e66;
  }

  p {
    margin: 0;
    font-size: 10px;
    color: #81918c;
  }
}

.alarm-timeline__mark {
  width: 10px;
  height: 28px;
  background: repeating-linear-gradient(0deg, #b9cbc5 0 4px, transparent 4px 7px);
  border-radius: 2px;
}

.alarm-timeline footer {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-top: 10px;
  margin-top: 12px;
  font-size: 9px;
  color: #7f8f8a;
  border-top: 1px solid #e5ece9;

  code {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "SFMono-Regular", Consolas, monospace;
    color: #3f6f64;
    white-space: nowrap;
  }

  small {
    margin-left: auto;
    white-space: nowrap;
  }
}

@media (width <= 620px) {
  .alarm-timeline footer {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .alarm-timeline footer small {
    width: 100%;
    margin-left: 0;
  }
}

/* 病房告警视图：卡片只承载业务信息，Topic 保留在页脚供开发联调。 */
.alarm-timeline {
  padding: 0;
  overflow: hidden;
  border-color: #d9e5e0;
}

.alarm-timeline > header {
  padding: 18px;
  background:
    linear-gradient(90deg, rgb(237 247 243 / 94%), rgb(252 254 253 / 96%)),
    repeating-linear-gradient(90deg, transparent 0 35px, rgb(34 108 91 / 5%) 35px 36px);
  border-bottom: 1px solid #e4ece9;

  h3 {
    margin-top: 3px;
    font-size: 18px;
    letter-spacing: -0.02em;
  }

  p {
    margin-top: 5px;
    font-size: 10px;
    line-height: 1.6;
    color: #70847e;
  }
}

.alarm-timeline__eyebrow {
  font-size: 9px !important;
  font-weight: 700;
  color: #367466 !important;
  letter-spacing: 0.12em;
}

.alarm-timeline__count {
  flex-shrink: 0;
  padding: 6px 9px;
  font-weight: 650;
  color: #526f67 !important;
  background: rgb(255 255 255 / 80%);
  border: 1px solid #cbded7;

  &[data-active="true"] {
    color: #a1362e !important;
    background: #fff2ef;
    border-color: #e6b7b1;
  }
}

.alarm-timeline__list {
  padding: 14px;
  margin-top: 0;

  li {
    position: relative;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 13px 14px 13px 18px;
    background: #fff;
    border: 1px solid #e3eae7;
    border-left: 0;

    &::before {
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      content: "";
      background: #d79443;
    }

    &[data-level="CRITICAL"] {
      background: #fff5f3;
      border-color: #e7b8b2;

      &::before {
        background: #a72c23;
      }
    }

    &[data-status="RESOLVED"] {
      background: #f3faf6;
      border-color: #c6dfd6;

      &::before {
        background: #368468;
      }
    }
  }
}

.alarm-timeline__meta {
  display: flex !important;
  grid-column: 1 / -1;
  gap: 9px !important;
  align-items: center;

  time {
    font-size: 9px;
    font-variant-numeric: tabular-nums;
    color: #7e8c88;
  }
}

.alarm-timeline__state {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: 9px;
  font-weight: 650;
  color: #955033;

  i {
    width: 6px;
    height: 6px;
    background: currentcolor;
    border-radius: 50%;
    box-shadow: 0 0 0 3px rgb(199 76 61 / 9%);
  }
}

.alarm-timeline__list li[data-level="CRITICAL"] .alarm-timeline__state {
  color: #a72c23;
}

.alarm-timeline__list li[data-status="RESOLVED"] .alarm-timeline__state {
  color: #2d7d62;
}

.alarm-timeline__content {
  display: grid;
  gap: 5px !important;
  min-width: 0;

  h4 {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 14px;
    font-weight: 680;
    color: #263d39;
    white-space: nowrap;
  }
}

.alarm-timeline__list .alarm-location span {
  padding: 0;
  color: #5f746e;
  background: transparent;
  border: 0;
}

.alarm-timeline__list button {
  min-height: 30px;
  padding: 6px 9px;
  font-weight: 600;
  transition:
    color 150ms ease,
    background-color 150ms ease;

  &:hover {
    color: #fff;
    background: #a84237;
    border-color: #a84237;
  }
}

.alarm-timeline footer {
  padding: 12px 18px;
  margin-top: 0;
  background: #f7faf9;
}

@media (width <= 640px) {
  .alarm-timeline__list li {
    grid-template-columns: 1fr;
  }

  .alarm-timeline__list button {
    justify-self: start;
  }
}
</style>
