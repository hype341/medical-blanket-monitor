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
        <button
          v-for="row in rows"
          :key="row.bed.id"
          type="button"
          :class="{ 'is-active': row.bed.id === selectedBedId }"
          @click="selectedBedId = row.bed.id"
        >
          <span>{{ row.wardName }} / {{ row.roomName }}</span>
          <strong>{{ row.bed.bedNo }} 床</strong>
          <small>{{ row.sensorName }}</small>
          <em>均值 {{ row.result.filteredMean.toFixed(1) }}</em>
        </button>
        <el-empty v-if="!rows.length" description="暂无可调参的毯子传感器" />
      </aside>

      <main class="tuning-workspace">
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
          />
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
const streamStatus = ref<"connecting" | "connected" | "reconnecting" | "closed">("closed");
let streamController: SensorStreamController | null = null;
let streamGeneration = 0;

const rows = computed(() =>
  store.bedSummaries
    .filter((summary) => summary.sensor)
    .map((summary) => ({
      bed: summary.bed,
      sensor: summary.sensor!,
      sensorName: summary.sensor?.name ?? "未命名传感器",
      wardName: summary.ward?.name ?? "未分病区",
      roomName: summary.room?.name ?? "未分病房",
      location: `${summary.ward?.name ?? ""} · ${summary.room?.name ?? ""} · ${summary.bed.bedNo} 床`,
      result: applySensorFilter(
        decodeSensorHex(summary.sensor?.latestData ?? ""),
        filterConfig.value,
      ),
    })),
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

watch(
  rows,
  (nextRows) => {
    if (!selectedBedId.value && nextRows[0]) selectedBedId.value = nextRows[0].bed.id;
  },
  { immediate: true },
);

watch(
  filterConfig,
  (config) => saveSensorFilterConfig(config),
  { deep: true },
);

watch(
  () => [selectedBedId.value, store.mqttSettings.websocketUrl, store.mqttSettings.username],
  () => connectSensorStream(),
);

onMounted(connectSensorStream);
onBeforeUnmount(disconnectSensorStream);

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

  > button {
    display: grid;
    gap: 3px;
    width: 100%;
    padding: 11px 14px;
    text-align: left;
    cursor: pointer;
    background: #fff;
    border: 0;
    border-bottom: 1px solid #edf2f0;

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

    &.is-active {
      background: #edf8f3;
      box-shadow: inset 3px 0 #2f806a;
    }
  }
}

.tuning-workspace {
  display: grid;
  gap: 14px;
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
