<template>
  <div
    class="sensor-heatmap"
    data-testid="sensor-heatmap"
    :data-status="status"
    :data-stream-status="streamStatus"
    :data-rendered-points="renderedPointCount"
    :data-processing-mode="processingMode"
  >
    <header>
      <div>
        <span>毯面感应热力图</span>
        <strong>{{ showTechnicalDetails ? "28 点/列 · 64 列" : "实时热力图" }}</strong>
      </div>
      <div class="sensor-heatmap__actions">
        <small>
          <i />
          {{
            showTechnicalDetails
              ? streamStatus === "connected"
                ? "MQTT 实时"
                : "快照同步"
              : "实时毯面"
          }}
        </small>
        <button
          type="button"
          aria-label="放大热力图"
          :disabled="!pointCount"
          @click="zoomed = true"
        >
          放大
        </button>
      </div>
    </header>

    <div class="sensor-heatmap__canvas-wrap">
      <canvas
        ref="canvasRef"
        :width="SENSOR_HEATMAP_COLUMNS * 8"
        :height="SENSOR_HEATMAP_ROWS * 8"
        role="img"
        aria-label="64 列 28 行毯面传感器压力热力图"
      />
      <div v-if="!pointCount" class="sensor-heatmap__empty">
        <strong>等待毯面数据</strong>
        <span>收到 MQTT 1792 字节数据后自动绘制</span>
      </div>
    </div>

    <footer>
      <span v-if="showTechnicalDetails">
        {{ pointCount }} / {{ SENSOR_POINT_COUNT }} 点 · 范围 {{ minValue }}–{{ peakValue }}
      </span>
      <span v-else>毯面压力分布</span>
      <span class="sensor-heatmap__footer-meta">
        <b v-if="showTechnicalDetails">
          {{ processingMode === "RAW" ? "仅原始数据" : "已启用处理" }}
        </b>
        <span class="sensor-heatmap__scale">白 <i /> 红</span>
      </span>
    </footer>

    <el-dialog
      v-model="zoomed"
      title="毯面感应热力图"
      width="min(960px, 92vw)"
      destroy-on-close
    >
      <div class="sensor-heatmap__zoom">
        <img :src="snapshotUrl" alt="放大的 64 列 28 行毯面感应热力图" />
        <div v-if="showTechnicalDetails">
          <span>28 点/列 × 64 列 · 共 1792 点</span>
          <span>原始范围 {{ minValue }}–{{ peakValue }} · 显示值 = 原始值 × 16</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="zoomed = false">关闭热力图</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  SENSOR_HEATMAP_COLUMNS,
  SENSOR_HEATMAP_ROWS,
  SENSOR_POINT_COUNT,
  buildSensorHeatmap,
} from "../sensor-heatmap";
import type { SensorStatus } from "../types";

const props = withDefaults(
  defineProps<{
    hexData?: string;
    status?: SensorStatus;
    refreshRateHz?: number;
    streamStatus?: "connecting" | "connected" | "reconnecting" | "closed";
    processingMode?: "RAW" | "PROCESSED";
    showTechnicalDetails?: boolean;
  }>(),
  {
    hexData: "",
    status: "OFFLINE",
    refreshRateHz: 1,
    streamStatus: "closed",
    processingMode: "RAW",
    showTechnicalDetails: false,
  },
);

const canvasRef = ref<HTMLCanvasElement>();
const renderedPointCount = ref(0);
const zoomed = ref(false);
const snapshotUrl = ref("");
const sourceCanvas = document.createElement("canvas");
sourceCanvas.width = SENSOR_HEATMAP_COLUMNS;
sourceCanvas.height = SENSOR_HEATMAP_ROWS;
const pointCount = computed(
  () => props.hexData.split(",").filter((value) => value.trim()).length,
);
const peakValue = computed(() =>
  buildSensorHeatmap(props.hexData).peakValue,
);
const minValue = computed(() =>
  buildSensorHeatmap(props.hexData).minValue,
);

let renderTimer: ReturnType<typeof setTimeout> | null = null;
let lastRenderedAt = 0;

function drawHeatmap(): void {
  renderTimer = null;
  const canvas = canvasRef.value;
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const sourceContext = sourceCanvas.getContext("2d");
  if (!context || !sourceContext) return;

  const frame = buildSensorHeatmap(props.hexData);
  sourceContext.clearRect(0, 0, frame.columns, frame.rows);
  const imageData = sourceContext.createImageData(frame.columns, frame.rows);
  imageData.data.set(frame.pixels);
  sourceContext.putImageData(imageData, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgb(38 63 61 / 10%)";
  for (let x = 0; x <= canvas.width; x += 8) context.fillRect(x, 0, 1, canvas.height);
  for (let y = 0; y <= canvas.height; y += 8) context.fillRect(0, y, canvas.width, 1);

  if (!frame.complete) {
    context.fillStyle = "rgb(238 243 241 / 78%)";
    context.fillRect(
      0,
      Math.max(0, frame.values.length / frame.columns) * (canvas.height / frame.rows),
      canvas.width,
      canvas.height,
    );
  }
  renderedPointCount.value = frame.values.length;
  snapshotUrl.value = canvas.toDataURL("image/png");
  lastRenderedAt = performance.now();
}

function scheduleDraw(): void {
  if (renderTimer) return;
  const interval = 1_000 / Math.min(10, Math.max(0.1, props.refreshRateHz));
  const wait =
    renderedPointCount.value === 0
      ? 0
      : Math.max(0, lastRenderedAt + interval - performance.now());
  renderTimer = setTimeout(drawHeatmap, wait);
}

watch(() => [props.hexData, props.refreshRateHz], scheduleDraw);
onMounted(drawHeatmap);
onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer);
});
</script>

<style scoped lang="scss">
.sensor-heatmap {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 11px;
  background:
    radial-gradient(circle at 75% 15%, rgb(63 139 119 / 13%), transparent 34%),
    #f4f9f7;
  border: 1px solid #d5e6df;

  > header,
  > footer {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  header {
    div {
      display: flex;
      gap: 8px;
      align-items: baseline;
    }

    span,
    small {
      font-size: 9px;
      color: #70857e;
    }

    strong {
      font-family: "Avenir Next", sans-serif;
      font-size: 11px;
      color: #245f54;
    }

    small {
      display: inline-flex;
      gap: 5px;
      align-items: center;
    }

    i {
      width: 6px;
      height: 6px;
      background: #9bada7;
      border-radius: 50%;
    }
  }

  footer {
    font-family: "Avenir Next", sans-serif;
    font-size: 9px;
    color: #698078;
  }
}

.sensor-heatmap__actions {
  display: flex;
  gap: 8px;
  align-items: center;

  button {
    padding: 4px 8px;
    font-size: 9px;
    color: #326b5e;
    cursor: zoom-in;
    background: #fff;
    border: 1px solid #c9ddd5;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  }
}

.sensor-heatmap__canvas-wrap {
  position: relative;
  width: min(100%, 520px);
  aspect-ratio: 64 / 28;
  margin-inline: auto;
  overflow: hidden;
  background: #eef3f1;
  border: 1px solid #c9dad4;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
}

.sensor-heatmap__empty {
  position: absolute;
  inset: 0;
  display: grid;
  gap: 5px;
  place-content: center;
  justify-items: center;
  color: #78988f;
  background: rgb(4 31 28 / 58%);

  strong {
    font-size: 12px;
    color: #a9c7be;
  }

  span {
    font-size: 9px;
  }
}

.sensor-heatmap__scale {
  display: inline-flex;
  gap: 5px;
  align-items: center;

  i {
    width: 66px;
    height: 5px;
    background: linear-gradient(90deg, #f8faf9, #ffeec7, #ffcc66, #f49137, #e04d2d, #c22422);
  }
}

.sensor-heatmap__footer-meta {
  display: inline-flex;
  gap: 9px;
  align-items: center;

  b {
    font-size: 8px;
    font-weight: 650;
    color: #2c6b5c;
  }
}

.sensor-heatmap[data-stream-status="connected"] header i {
  background: #4ab18b;
  box-shadow: 0 0 0 3px rgb(74 177 139 / 14%);
}

.sensor-heatmap[data-status="ALARM"] {
  border-color: #e2aaa5;
}

.sensor-heatmap__zoom {
  display: grid;
  gap: 10px;

  img {
    display: block;
    width: 100%;
    max-height: 66vh;
    object-fit: contain;
    image-rendering: pixelated;
    background: #f3f7f5;
    border: 1px solid #d3e2dc;
  }

  > div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    justify-content: space-between;
    font-size: 10px;
    color: #688078;
  }
}

@media (width <= 700px) {
  .sensor-heatmap__canvas-wrap {
    width: 100%;
  }

  .sensor-heatmap__actions {
    gap: 5px;
  }
}
</style>
