<template>
  <div class="sensor-tuning-page">
    <header class="tuning-header">
      <div>
        <span>开发者工具</span>
        <h1>毯面数据调参</h1>
        <p>调整滤波、阈值和窗口大小，实时观察平均值与热力图变化。</p>
      </div>
      <span class="tuning-header__status" :data-stream-status="streamStatus">
        <i />
        {{ streamStatus === "connected" ? "MQTT 实时" : "等待数据" }}
      </span>
    </header>

    <div class="tuning-layout">
      <aside class="tuning-bed-list">
        <header>
          <div>
            <span>调参对象</span>
            <h2>床位列表</h2>
          </div>
          <strong>{{ rows.length }}</strong>
        </header>
        <div class="tuning-bed-toolbar">
          <el-button size="small" @click="toggleSelectAll">
            {{ allBedsSelected ? "取消全选" : "全选" }}
          </el-button>
          <span>已选 {{ selectedBedIds.length }} 张</span>
        </div>
        <div
          v-for="row in rows"
          :key="row.bed.id"
          class="tuning-bed-item"
          :class="{ 'is-active': row.bed.id === selectedBedId }"
        >
          <el-checkbox
            :model-value="selectedBedIds.includes(row.bed.id)"
            :aria-label="`选择 ${row.wardName} ${row.roomName} ${row.bed.bedNo} 床`"
            @change="(checked) => toggleBedSelection(row.bed.id, checked)"
          />
          <button type="button" @click="selectedBedId = row.bed.id">
            <span>{{ row.wardName }} / {{ row.roomName }}</span>
            <strong>{{ row.bed.bedNo }} 床</strong>
            <small>{{ row.sensorName }}</small>
            <em>均值 {{ row.result.filteredMean.toFixed(1) }}</em>
          </button>
        </div>
        <el-empty v-if="!rows.length" description="暂无可调参的毯子传感器" />
      </aside>

      <main class="tuning-workspace">
        <section class="tuning-apply-bar">
          <div>
            <span>批量应用</span>
            <strong>{{ selectedRow?.sensorName ?? "当前参数" }}</strong>
          </div>
          <el-button
            :disabled="!selectedBedIds.length"
            @click="applyCurrentConfig(selectedBedIds, '选中床位')"
          >
            应用到选中床位
          </el-button>
          <el-button
            type="primary"
            :disabled="!rows.length"
            @click="applyCurrentConfig(rows.map((row) => row.bed.id), '全部床位')"
          >
            应用到全部床位
          </el-button>
        </section>

        <SensorFilterPanel
          v-model="filterConfig"
          :result="selectedResult"
        />

        <section class="tuning-preview">
          <header>
            <div>
              <span>实时预览</span>
              <h2>{{ selectedRow?.sensorName ?? "请选择床位" }}</h2>
            </div>
            <small>{{ selectedRow?.location ?? "暂无数据" }}</small>
          </header>
          <SensorDeviceGraphic
            v-if="selectedRow"
            :sensor="selectedRow.sensor"
            :refresh-rate-hz="1"
            :stream-status="streamStatus"
            :show-raw-data="true"
            :display-data="filteredSensorHex"
            :show-technical-details="true"
            :gain-enabled="filterConfig.gainEnabled"
            :gain-power="filterConfig.gainPower"
            :gain-multiplier="filterConfig.gainMultiplier"
            :processing-mode="
              filterConfig.filterEnabled || filterConfig.thresholdEnabled
                ? 'PROCESSED'
                : 'RAW'
            "
          />
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import SensorDeviceGraphic from "../components/SensorDeviceGraphic.vue";
import SensorFilterPanel from "../components/SensorFilterPanel.vue";
import { decodeSensorHex } from "../sensor-heatmap";
import {
  applySensorFilter,
  loadSensorFilterConfig,
  saveSensorFilterConfig,
  type SensorFilterConfig,
} from "../sensor-filter";
import {
  extractSensorHexData,
  openSensorDataStream,
  type SensorStreamController,
} from "../stream-api";
import { useMonitoringStore } from "../store";

const store = useMonitoringStore();
const filterConfig = ref<SensorFilterConfig>(loadSensorFilterConfig());
const selectedBedId = ref("");
const selectedBedIds = ref<string[]>([]);
const configRevision = ref(0);
const streamStatus = ref<"connecting" | "connected" | "reconnecting" | "closed">("closed");
let streamController: SensorStreamController | null = null;
let streamGeneration = 0;
let snapshotTimer: ReturnType<typeof setInterval> | null = null;
let snapshotFetching = false;

const rows = computed(() =>
  store.bedSummaries
    .filter((summary) => summary.sensor)
    .map((summary) => {
      void configRevision.value;
      const bedConfig =
        summary.bed.id === selectedBedId.value
          ? filterConfig.value
          : loadSensorFilterConfig(summary.bed.id);
      return {
        bed: summary.bed,
        sensor: summary.sensor!,
        sensorName: summary.sensor?.name ?? "未命名传感器",
        wardName: summary.ward?.name ?? "未分病区",
        roomName: summary.room?.name ?? "未分病房",
        location: `${summary.ward?.name ?? ""} · ${summary.room?.name ?? ""} · ${summary.bed.bedNo} 床`,
        result: applySensorFilter(
          decodeSensorHex(summary.sensor?.latestData ?? ""),
          bedConfig,
        ),
      };
    }),
);

const selectedRow = computed(
  () => rows.value.find((row) => row.bed.id === selectedBedId.value) ?? rows.value[0],
);
const selectedResult = computed(
  () => selectedRow.value?.result ??
    applySensorFilter([], filterConfig.value),
);
const filteredSensorHex = computed(() =>
  selectedResult.value.values
    .map((value) => value.toString(16).padStart(2, "0"))
    .join(","),
);
const allBedsSelected = computed(
  () => rows.value.length > 0 && selectedBedIds.value.length === rows.value.length,
);

watch(
  rows,
  (nextRows) => {
    if (!selectedBedId.value && nextRows[0]) {
      selectedBedId.value = nextRows[0].bed.id;
      selectedBedIds.value = [nextRows[0].bed.id];
    }
  },
  { immediate: true },
);

watch(
  selectedBedId,
  (bedId) => {
    if (bedId) filterConfig.value = loadSensorFilterConfig(bedId);
  },
  { immediate: true },
);

watch(
  filterConfig,
  (config) => {
    if (!selectedBedId.value) return;
    saveSensorFilterConfig(selectedBedId.value, config);
    configRevision.value += 1;
  },
  { deep: true },
);

watch(
  () => [selectedBedId.value, store.mqttSettings.websocketUrl, store.mqttSettings.username],
  () => {
    connectSensorStream();
    void refreshSelectedSensorSnapshot();
  },
);

onMounted(() => {
  connectSensorStream();
  void refreshSelectedSensorSnapshot();
  snapshotTimer = setInterval(() => void refreshSelectedSensorSnapshot(), 1_000);
});
onBeforeUnmount(() => {
  disconnectSensorStream();
  if (snapshotTimer) clearInterval(snapshotTimer);
});

function toggleBedSelection(bedId: string, checked: string | number | boolean): void {
  const set = new Set(selectedBedIds.value);
  if (Boolean(checked)) set.add(bedId);
  else set.delete(bedId);
  selectedBedIds.value = [...set];
}

function toggleSelectAll(): void {
  selectedBedIds.value = allBedsSelected.value
    ? []
    : rows.value.map((row) => row.bed.id);
}

function applyCurrentConfig(targets: readonly string[], label: string): void {
  if (!targets.length) return;
  targets.forEach((bedId) => saveSensorFilterConfig(bedId, filterConfig.value));
  configRevision.value += 1;
  ElMessage.success(`参数已应用到${label}，共 ${targets.length} 张床位`);
}

function connectSensorStream(): void {
  const generation = ++streamGeneration;
  streamController?.close();
  streamController = null;
  streamStatus.value = "closed";
  const row = selectedRow.value;
  const dataTopic = store.bedSummaries.find((summary) => summary.bed.id === row?.bed.id)?.dataTopic;
  if (!row || !dataTopic) return;

  streamController = openSensorDataStream(store.mqttSettings, dataTopic, {
    onStatus: (status) => {
      if (generation === streamGeneration) streamStatus.value = status;
    },
    onData: (reading) => {
      if (generation !== streamGeneration || selectedRow.value?.bed.id !== row.bed.id) return;
      store.syncSensorSnapshot(row.bed.id, {
        status: reading.status,
        data: extractSensorHexData(reading),
        observedAt: reading.observedAt || new Date().toISOString(),
        metrics: reading.metrics,
      });
    },
  });
}

function disconnectSensorStream(): void {
  streamGeneration += 1;
  streamController?.close();
  streamController = null;
  streamStatus.value = "closed";
}

async function refreshSelectedSensorSnapshot(): Promise<void> {
  if (document.visibilityState !== "visible" || snapshotFetching) return;
  const bedId = selectedRow.value?.bed.id;
  if (!bedId) return;
  snapshotFetching = true;
  try {
    const response = await fetch(`/api/public/sensors/${encodeURIComponent(bedId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const snapshot = (await response.json()) as {
      status?: "ONLINE" | "STALE" | "OFFLINE" | "ALARM";
      data?: string;
      observedAt?: string;
    };
    if (selectedRow.value?.bed.id === bedId) {
      store.syncSensorSnapshot(bedId, snapshot);
    }
  } catch {
    // MQTT remains active while the snapshot endpoint recovers.
  } finally {
    snapshotFetching = false;
  }
}
</script>

<style scoped lang="scss">
.sensor-tuning-page {
  color: #173c3a;
}

.tuning-header {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 8px 2px 20px;
  border-bottom: 1px solid #dbe6e2;

  span {
    font-size: 10px;
    font-weight: 650;
    color: #4b766c;
  }

  h1 {
    margin: 5px 0 4px;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: clamp(28px, 3vw, 40px);
    font-weight: 680;
    letter-spacing: -0.04em;
  }

  p {
    margin: 0;
    font-size: 12px;
    color: #72857f;
  }
}

.tuning-header__status {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  padding: 6px 9px;
  background: #f3f8f6;
  border: 1px solid #d2e1dc;

  i {
    width: 7px;
    height: 7px;
    background: #91a49e;
    border-radius: 50%;
  }

  &[data-stream-status="connected"] i {
    background: #42a781;
    box-shadow: 0 0 0 3px rgb(66 167 129 / 14%);
  }
}

.tuning-layout {
  display: grid;
  grid-template-columns: minmax(230px, 0.72fr) minmax(0, 1.6fr);
  gap: 18px;
  margin-top: 18px;
}

.tuning-bed-list,
.tuning-workspace {
  min-width: 0;
}

.tuning-bed-list {
  align-self: start;
  overflow: hidden;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px;
    border-bottom: 1px solid #e3ece8;

    span {
      font-size: 9px;
      color: #7d8e89;
    }

    h2 {
      margin: 3px 0 0;
      font-size: 15px;
    }

    strong {
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      font-family: "Avenir Next", sans-serif;
      font-size: 11px;
      color: #2c6b5b;
      background: #edf7f2;
      border: 1px solid #c7dfd7;
      border-radius: 50%;
    }
  }

}

.tuning-bed-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f5faf7;
  border-bottom: 1px solid #e2ece8;

  span {
    font-size: 9px;
    color: #6f847d;
  }
}

.tuning-bed-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  border-bottom: 1px solid #edf2f0;

  &.is-active {
    background: #edf8f3;
    box-shadow: inset 3px 0 #2f806a;

    > button {
      background: #edf8f3;
    }
  }

  :deep(.el-checkbox) {
    margin-left: 12px;
  }

  > button {
    display: grid;
    gap: 3px;
    width: 100%;
    padding: 11px 14px;
    text-align: left;
    cursor: pointer;
    background: #fff;
    border: 0;

    span,
    small {
      font-size: 9px;
      color: #788c85;
    }

    strong {
      font-size: 12px;
      color: #275c51;
    }

    em {
      font-family: "Avenir Next", sans-serif;
      font-size: 9px;
      font-style: normal;
      color: #9a792c;
    }

    &:hover {
      background: #f7fbf9;
    }
  }
}

.tuning-workspace {
  display: grid;
  gap: 14px;
}

.tuning-apply-bar {
  display: flex;
  gap: 9px;
  align-items: center;
  padding: 10px 12px;
  background: linear-gradient(90deg, #edf8f3, #f9fcfb);
  border: 1px solid #cfe3db;

  > div {
    display: grid;
    gap: 3px;
    margin-right: auto;
  }

  span {
    font-size: 9px;
    color: #72877f;
  }

  strong {
    font-size: 11px;
    color: #285f52;
  }
}

.tuning-preview {
  padding: 16px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;

    span,
    small {
      font-size: 9px;
      color: #7d8e89;
    }

    h2 {
      margin: 4px 0 0;
      font-size: 16px;
    }
  }
}

@media (width <= 900px) {
  .tuning-layout {
    grid-template-columns: 1fr;
  }

  .tuning-bed-list {
    max-height: 280px;
    overflow: auto;
  }
}

@media (width <= 560px) {
  .tuning-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
