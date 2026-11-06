<template>
  <article
    class="bed-card"
    :data-status="summary.bed.status"
    :data-sensor-status="summary.sensor?.status ?? 'OFFLINE'"
    data-testid="bed-card"
    tabindex="0"
    @click="emit('open', summary.bed.id)"
    @keydown.enter="emit('open', summary.bed.id)"
    @keydown.space.prevent="emit('open', summary.bed.id)"
  >
    <span class="bed-card__status-rail" />

    <header class="bed-card__header">
      <div>
        <span class="bed-card__location">{{ summary.room?.roomNo ?? "未分房" }} 病房</span>
        <strong>{{ summary.bed.bedNo }} 床</strong>
      </div>
      <span class="bed-card__state" :class="sensorState.className">
        <span class="bed-card__state-dot" />
        {{ sensorState.label }}
      </span>
    </header>

    <div class="bed-card__patient">
      <div class="bed-card__patient-identity">
        <img
          v-if="summary.bed.patientName"
          :src="summary.bed.patientAvatar || '/images/avatars/default.svg'"
          alt=""
          @error="useDefaultAvatar"
        />
        <span>{{ summary.bed.patientName ?? "空床待分配" }}</span>
      </div>
      <span>{{ patientStateLabel }} · {{ bedStateLabel }}</span>
    </div>

    <div v-if="summary.sensor" class="bed-card__sensor">
      <span class="bed-card__sensor-glyph" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <div>
        <span>毯子传感器</span>
        <strong>{{ summary.sensor.deviceKey }}</strong>
      </div>
      <small>{{ summary.sensor.model ?? "通用设备" }}</small>
    </div>
    <div v-else class="bed-card__empty">尚未绑定毯子传感器</div>

    <div v-if="unresolvedAlarms.length" class="bed-card__alarm">
      <span>{{ unresolvedAlarms.length }} 条未解决告警</span>
      <strong>{{ unresolvedAlarms[0]?.title }}</strong>
    </div>

    <footer class="bed-card__footer">
      <span>{{ summary.cameras.length }} 路摄像头</span>
      <span>{{ updateLabel }}</span>
      <button
        v-if="canDelete"
        type="button"
        class="bed-card__delete"
        @click.stop="emit('delete', summary.bed.id)"
      >
        删除床位
      </button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AlarmEnvelope } from "../recording";
import type { BedMonitorSummary, SensorStatus } from "../types";

const props = defineProps<{
  summary: BedMonitorSummary;
  alarms?: AlarmEnvelope[];
  canDelete?: boolean;
}>();

const emit = defineEmits<{
  open: [bedId: string];
  delete: [bedId: string];
}>();

const statusPresentation: Record<SensorStatus, { label: string; className: string }> = {
  ONLINE: { label: "数据在线", className: "is-online" },
  STALE: { label: "数据延迟", className: "is-warning" },
  OFFLINE: { label: "传感器离线", className: "is-offline" },
  ALARM: { label: "状态异常", className: "is-alert" },
};

const sensorState = computed(() => statusPresentation[props.summary.sensor?.status ?? "OFFLINE"]);

const bedStateLabel = computed(() => {
  const labels = {
    AVAILABLE: "空床",
    OCCUPIED: "住院中",
    CLEANING: "清洁中",
    OFFLINE: "床位停用",
  };
  return labels[props.summary.bed.status];
});

const patientStateLabel = computed(() => {
  const labels = {
    STABLE: "平稳",
    OBSERVATION: "观察中",
    CRITICAL: "重点关注",
  };
  return labels[props.summary.bed.patientStatus ?? "STABLE"];
});

const updateLabel = computed(() =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(props.summary.bed.updatedAt)),
);
const unresolvedAlarms = computed(() =>
  (props.alarms ?? []).filter((alarm) => alarm.status !== "RESOLVED"),
);

function useDefaultAvatar(event: Event): void {
  const image = event.target as HTMLImageElement;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = "/images/avatars/default.svg";
}
</script>

<style scoped lang="scss">
.bed-card {
  position: relative;
  min-height: 222px;
  padding: 18px 18px 14px 22px;
  overflow: hidden;
  cursor: pointer;
  background: #fff;
  border: 1px solid #d8e4df;
  border-radius: 4px;
  box-shadow: 0 1px 0 rgb(13 63 60 / 5%);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: #8eb9ab;
    box-shadow: 0 12px 30px rgb(13 63 60 / 10%);
    transform: translateY(-2px);
  }

  &[data-sensor-status="ALARM"] {
    border-color: #e2aaa3;
  }
}

.bed-card__status-rail {
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: #2f806a;
}

.bed-card[data-sensor-status="STALE"] .bed-card__status-rail {
  background: #c84a3f;
}

.bed-card[data-sensor-status="OFFLINE"] .bed-card__status-rail {
  background: #8b9794;
}

.bed-card[data-sensor-status="ALARM"] .bed-card__status-rail {
  background: #c84a3f;
}

.bed-card__header,
.bed-card__patient,
.bed-card__footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.bed-card__header {
  align-items: flex-start;

  div {
    display: grid;
    gap: 3px;
  }

  strong {
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: 25px;
    font-weight: 700;
    color: #173c3a;
    letter-spacing: -0.04em;
  }
}

.bed-card__patient-identity {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;

  img {
    width: 26px;
    height: 26px;
    object-fit: cover;
    background: #fff;
    border: 1px solid #dbe6e2;
    border-radius: 50%;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.bed-card__location {
  font-size: 12px;
  font-weight: 600;
  color: #647a76;
}

.bed-card__state {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 600;
  color: #24624f;
  white-space: nowrap;
  background: #edf7f2;
  border: 1px solid #c6ddd5;
  border-radius: 3px;

  &.is-warning {
    color: #aa352c;
    background: #fff0ee;
    border-color: #e4b2ac;
  }

  &.is-offline {
    color: #66726f;
    background: #f2f5f4;
    border-color: #d5dcda;
  }

  &.is-alert {
    color: #aa352c;
    background: #fff0ee;
    border-color: #e6b4ae;
  }
}

.bed-card__state-dot {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
}

.bed-card__patient {
  padding-bottom: 14px;
  margin-top: 20px;
  font-size: 15px;
  font-weight: 600;
  color: #1b302e;
  border-bottom: 1px solid #e7eeeb;

  span:last-child {
    font-size: 12px;
    font-weight: 500;
    color: #748581;
  }
}

.bed-card__sensor {
  display: flex;
  gap: 11px;
  align-items: center;
  padding: 10px;
  margin-top: 14px;
  background: #f8fbfa;
  border: 1px dashed #ccdcd6;

  div {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  div span,
  small {
    font-size: 9px;
    color: #7b8c87;
  }

  div strong {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "Avenir Next", sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: #315f55;
    white-space: nowrap;
  }

  small {
    margin-left: auto;
  }
}

.bed-card__sensor-glyph {
  position: relative;
  display: grid;
  flex-shrink: 0;
  width: 34px;
  height: 26px;
  overflow: hidden;
  background:
    repeating-linear-gradient(90deg, transparent 0 5px, rgb(47 128 106 / 18%) 5px 6px), #e8f4ef;
  border: 1px solid #a9cfc3;
  border-radius: 12px 12px 4px 4px;

  i {
    position: absolute;
    left: 7px;
    width: 18px;
    height: 1px;
    background: #7db4a3;

    &:nth-child(1) {
      top: 7px;
    }

    &:nth-child(2) {
      top: 12px;
    }

    &:nth-child(3) {
      top: 17px;
    }
  }
}

.bed-card__empty {
  padding: 12px;
  margin-top: 15px;
  font-size: 12px;
  color: #7b8986;
  text-align: center;
  border: 1px dashed #d4dfdc;
}

.bed-card__alarm {
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  margin-top: 10px;
  color: #a43d34;
  background: #fff0ee;
  border-left: 3px solid #c84a3f;

  span {
    font-size: 9px;
    font-weight: 650;
  }

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 10px;
    white-space: nowrap;
  }
}

.bed-card__footer {
  gap: 8px;
  margin-top: 16px;
  font-size: 11px;
  color: #82918d;
}

.bed-card__delete {
  padding: 3px 6px;
  margin-left: auto;
  font-size: 10px;
  color: #a43d34;
  cursor: pointer;
  background: #fff7f6;
  border: 1px solid #e2b8b3;

  &:focus-visible {
    outline: 2px solid #a43d34;
    outline-offset: 2px;
  }
}
</style>
