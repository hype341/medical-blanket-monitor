<template>
  <section class="alarm-timeline">
    <header>
      <div>
        <h3>告警时间线</h3>
        <p>订阅 MQTT 告警主题，按发生时间生成记录。</p>
      </div>
      <span>{{ alarms.length }} 条</span>
    </header>

    <ol v-if="alarms.length" class="alarm-timeline__list">
      <li
        v-for="alarm in alarms"
        :key="alarm.alarmId"
        :data-level="alarm.level"
        :data-status="alarm.status"
      >
        <time>{{ formatTime(alarm.occurredAt) }}</time>
        <div>
          <strong>
            {{ alarm.title }}
            <span>{{ alarm.status === "RESOLVED" ? "已解决" : "报警中" }}</span>
          </strong>
          <p>{{ alarm.detail }}</p>
          <small>
            {{ alarm.code }} · {{ alarm.cameraKey }}
            <template v-if="alarm.resolvedAt">· {{ formatTime(alarm.resolvedAt) }} 解决</template>
          </small>
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
        <strong>暂无告警</strong>
        <p>有告警消息时将保存时间节点，并触发对应摄像头片段留存。</p>
      </div>
    </div>

    <footer>
      <span>告警主题</span>
      <code>medical-blanket/v1/+/+/+/alarm/+</code>
      <small>告警前 30 秒 + 后 60 秒自动剪辑</small>
    </footer>
  </section>
</template>

<script setup lang="ts">
import type { AlarmEnvelope } from "../recording";

withDefaults(
  defineProps<{
    alarms?: AlarmEnvelope[];
  }>(),
  {
    alarms: () => [],
  },
);

const emit = defineEmits<{
  resolve: [alarmId: string];
}>();

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
</style>
