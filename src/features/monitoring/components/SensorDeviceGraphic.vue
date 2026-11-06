<template>
  <div
    class="sensor-graphic"
    data-testid="sensor-graphic"
    :data-status="sensor?.status ?? 'OFFLINE'"
  >
    <div class="sensor-graphic__visual" aria-hidden="true">
      <svg viewBox="0 0 240 160" role="presentation">
        <path
          class="sensor-graphic__blanket"
          d="M33 51c34-20 137-20 174 0v66c-37 20-140 20-174 0V51Z"
        />
        <path class="sensor-graphic__fold" d="M65 43v77M108 38v88M151 38v88M191 45v75" />
        <path class="sensor-graphic__edge" d="M35 108c40 18 130 18 170 0" />
        <circle class="sensor-graphic__sensor" cx="202" cy="50" r="8" />
        <path class="sensor-graphic__wave" d="M214 39c7 6 10 15 10 24M220 32c11 9 17 22 16 37" />
      </svg>
    </div>

    <div class="sensor-graphic__identity">
      <span>毯子传感器</span>
      <strong>{{ sensor?.name ?? "尚未绑定传感器" }}</strong>
      <small>{{ sensor?.deviceKey ?? "请先完成设备绑定" }}</small>
    </div>

    <div class="sensor-graphic__meta">
      <div v-if="sensor?.latestData" class="sensor-graphic__raw-data">
        <span>{{ dataByteCount }} 字节数据</span>
        <code :title="sensor.latestData">{{ sensor.latestData }}</code>
      </div>

      <div class="sensor-graphic__state">
        <span />
        {{ statusLabel }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { SensorDevice } from "../types";

const props = defineProps<{
  sensor: SensorDevice | null;
}>();

const statusLabel = computed(() => {
  const labels = {
    ONLINE: "传感器在线",
    STALE: "连接延迟",
    OFFLINE: "等待接入",
    ALARM: "状态异常",
  };
  return labels[props.sensor?.status ?? "OFFLINE"];
});

const dataByteCount = computed(
  () => props.sensor?.latestData?.split(",").filter(Boolean).length ?? 0,
);
</script>

<style scoped lang="scss">
.sensor-graphic {
  display: grid;
  grid-template-columns: minmax(150px, 0.8fr) minmax(170px, 1.2fr) auto;
  gap: 18px;
  align-items: center;
  padding: 18px;
  margin-top: 16px;
  background: radial-gradient(circle at 18% 50%, rgb(80 155 133 / 12%), transparent 32%), #f8fbfa;
  border: 1px solid #dbe7e2;
}

.sensor-graphic__visual {
  overflow: hidden;
  background: #e9f4ef;
  border-radius: 2px;

  svg {
    display: block;
    width: 100%;
    height: 125px;
  }
}

.sensor-graphic__blanket {
  fill: #fbfdfc;
  stroke: #2f806a;
  stroke-width: 2;
}

.sensor-graphic__fold,
.sensor-graphic__edge {
  fill: none;
  stroke: #8ebcac;
  stroke-width: 1;
}

.sensor-graphic__sensor {
  fill: #2f806a;
  stroke: #fff;
  stroke-width: 3;
}

.sensor-graphic__wave {
  fill: none;
  stroke: #5ca38e;
  stroke-width: 2;
  stroke-linecap: round;
}

.sensor-graphic__identity {
  display: grid;
  gap: 5px;
  min-width: 0;

  span {
    font-size: 10px;
    font-weight: 650;
    color: #668078;
  }

  strong {
    min-width: 0;
    font-size: 16px;
    font-weight: 650;
    line-height: 1.35;
    color: #173c3a;
    overflow-wrap: normal;
  }

  small {
    font-family: "Avenir Next", sans-serif;
    font-size: 10px;
    color: #7d8e89;
    overflow-wrap: anywhere;
  }
}

.sensor-graphic__state {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 6px 9px;
  font-size: 10px;
  font-weight: 600;
  color: #66726f;
  background: #f2f5f4;
  border: 1px solid #d6dfdc;

  span {
    width: 6px;
    height: 6px;
    background: currentcolor;
    border-radius: 50%;
  }
}

.sensor-graphic__meta {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.sensor-graphic__raw-data {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #d6e4df;

  span {
    font-size: 8px;
    color: #7e918a;
  }

  code {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 11px;
    color: #215f53;
    white-space: nowrap;
  }
}

.sensor-graphic[data-status="ONLINE"] .sensor-graphic__state {
  color: #24624f;
  background: #edf7f2;
  border-color: #bfd8d0;
}

.sensor-graphic[data-status="STALE"] .sensor-graphic__state {
  color: #8b611f;
  background: #fbf5e7;
  border-color: #e4cfaa;
}

.sensor-graphic[data-status="ALARM"] .sensor-graphic__state {
  color: #aa352c;
  background: #fff0ee;
  border-color: #e4b2ac;
}

@container sensor-panel (width <= 640px) {
  .sensor-graphic {
    grid-template-columns: minmax(135px, 0.75fr) minmax(0, 1.25fr);
    gap: 14px;
  }

  .sensor-graphic__meta {
    display: flex;
    flex-wrap: wrap;
    grid-column: 1 / -1;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    justify-items: stretch;
  }

  .sensor-graphic__state {
    justify-self: auto;
  }
}

@media (width <= 620px) {
  .sensor-graphic {
    grid-template-columns: 1fr;
  }

  .sensor-graphic__meta {
    justify-items: start;
  }

  .sensor-graphic__state {
    justify-self: start;
  }
}
</style>
