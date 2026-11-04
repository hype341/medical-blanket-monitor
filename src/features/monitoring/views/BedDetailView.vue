<template>
  <div v-if="summary" class="bed-detail">
    <header class="detail-header">
      <button class="detail-header__back" type="button" @click="router.push('/beds')">
        返回床位监护
      </button>
      <div class="detail-header__identity">
        <div>
          <span>{{ summary.ward?.name }} · {{ summary.room?.name }}</span>
          <h1>{{ summary.bed.bedNo }} 床 · {{ summary.bed.patientName ?? "空床" }}</h1>
          <small v-if="summary.bed.lastEditedBy">
            最后修改：{{ summary.bed.lastEditedBy === "ADMIN" ? "管理员" : "护士" }}
          </small>
        </div>
        <div class="detail-header__actions">
          <span class="patient-status" :data-status="summary.bed.patientStatus ?? 'STABLE'">
            {{ patientStatusLabel }}
          </span>
          <span class="detail-header__status" :data-status="summary.sensor?.status ?? 'OFFLINE'">
            {{ sensorStatusLabel }}
          </span>
          <el-button plain type="primary" @click="patientEditorVisible = true">
            编辑患者信息
          </el-button>
        </div>
      </div>
    </header>

    <div class="detail-grid">
      <section class="video-panel">
        <header>
          <div>
            <span>床旁视频</span>
            <h2>{{ selectedCamera?.name ?? "尚未绑定摄像头" }}</h2>
          </div>
          <span class="video-panel__protocol">
            {{ recordingAt ? "连续回放 · 双缓冲" : "WebRTC 优先" }}
          </span>
        </header>

        <RecordingPlayer
          v-if="recordingAt"
          :segments="recordingSegments"
          :target-at="recordingAt"
          @time-update="playbackPositionAt = $event"
        />
        <UniversalVideoPlayer
          v-else
          class="detail-player"
          :camera-name="selectedCamera?.name ?? '床旁摄像头'"
          :camera-status="selectedCamera?.status ?? 'OFFLINE'"
          :playback="selectedCamera?.playback ?? null"
        />
        <button v-if="recordingAt" type="button" class="back-to-live" @click="returnToLive">
          返回实时画面
        </button>
        <CameraLinkPanel :camera="selectedCamera" compact />
        <RecordingTimeline
          :segments="recordingSegments"
          :alarms="alarms"
          :retention-minutes="store.monitoringPolicy.recordingRetentionMinutes"
          :current-at="playbackPositionAt || recordingAt"
          @seek="seekRecording"
          @select-alarm="selectAlarm"
        />
        <AlarmTimeline
          :alarms="alarms"
          :location-label="`${summary.ward?.name ?? ''} · ${summary.room?.name ?? ''} · ${summary.bed.bedNo} 床`"
          :topic="summary.alarmTopic ?? ''"
          @resolve="store.resolveAlarm"
        />
      </section>

      <section class="sensor-panel">
        <header>
          <div>
            <span>毯子传感器</span>
            <h2>{{ summary.sensor?.name ?? "尚未绑定传感器" }}</h2>
          </div>
          <span>{{ lastSeenLabel }}</span>
        </header>

        <div class="sensor-refresh">
          <div>
            <strong>传感器图形帧率</strong>
            <small>每秒重绘多少帧，可输入 0.1–10 帧/秒。</small>
          </div>
          <div class="sensor-refresh__control">
            <label class="sensor-refresh__input">
              <input
                v-model.number="sensorRefreshRate"
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                aria-label="传感器图形帧率"
                @change="normalizeRefreshRate"
              />
              <span>帧/秒</span>
            </label>
            <div class="sensor-refresh__options">
              <button
                v-for="rate in sensorRefreshRates"
                :key="rate"
                type="button"
                :class="{ 'is-active': sensorRefreshRate === rate }"
                @click="sensorRefreshRate = rate"
              >
                {{ rate }} 帧/秒
              </button>
            </div>
          </div>
        </div>

        <SensorDeviceGraphic :sensor="summary.sensor" />

        <div class="sensor-contract">
          <span>数据接口</span>
          <p>传感器只上报标准化设备事件，由后续分析处理器解释和扩展。</p>
          <code v-if="summary.dataTopic">数据：{{ summary.dataTopic }}</code>
          <code v-if="summary.alarmTopic">告警：{{ summary.alarmTopic }}</code>
          <small>床位数据主题 → 传感器图；床位告警主题 → 告警记录与录像定位</small>
        </div>
        <AnalysisExtensionPanel />
      </section>
    </div>

    <PatientEditor
      v-model="patientEditorVisible"
      :bed="summary.bed"
      :room-name="summary.room?.name ?? '未分房'"
      :wards="store.wards"
      :rooms="store.rooms"
      :can-edit-location="store.activeRole === 'ADMIN'"
      @save="savePatient"
    />
  </div>

  <el-empty v-else description="未找到该床位，或当前账号无权访问">
    <el-button type="primary" @click="router.push('/beds')">返回床位监护</el-button>
  </el-empty>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import UniversalVideoPlayer from "@/components/UniversalVideoPlayer/index.vue";
import AlarmTimeline from "../components/AlarmTimeline.vue";
import AnalysisExtensionPanel from "../components/AnalysisExtensionPanel.vue";
import CameraLinkPanel from "../components/CameraLinkPanel.vue";
import PatientEditor from "../components/PatientEditor.vue";
import RecordingPlayer from "../components/RecordingPlayer.vue";
import RecordingTimeline from "../components/RecordingTimeline.vue";
import SensorDeviceGraphic from "../components/SensorDeviceGraphic.vue";
import {
  findPlaybackSegment,
  mapMediaMtxPlaybackItems,
  type AlarmEnvelope,
  type MediaMtxPlaybackItem,
  type RecordingSegment,
} from "../recording";
import { useMonitoringStore } from "../store";
import type { PatientUpdateInput } from "../types";

const route = useRoute();
const router = useRouter();
const store = useMonitoringStore();
const sensorRefreshRates = [1, 2, 5, 10];
const sensorRefreshRate = ref(1);
const patientEditorVisible = ref(false);

const summary = computed(() =>
  store.bedSummaries.find((item) => item.bed.id === route.params.bedId),
);

const selectedCamera = computed(() => summary.value?.cameras[0] ?? null);

const sensorStatusLabel = computed(() => {
  const labels = {
    ONLINE: "传感器数据在线",
    STALE: "传感器数据延迟",
    OFFLINE: "毯子传感器离线",
    ALARM: "毯子传感器异常",
  };
  return labels[summary.value?.sensor?.status ?? "OFFLINE"];
});

const patientStatusLabel = computed(() => {
  const labels = {
    STABLE: "患者平稳",
    OBSERVATION: "观察中",
    CRITICAL: "重点关注",
  };
  return labels[summary.value?.bed.patientStatus ?? "STABLE"];
});

const lastSeenLabel = computed(() => {
  const lastSeenAt = summary.value?.sensor?.lastSeenAt;
  if (!lastSeenAt) return "无数据";
  return `更新于 ${new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(lastSeenAt))}`;
});

// 回放与告警数据由 RecordingTimelineSource / MQTT 告警主题接入。
const recordingSegments = ref<RecordingSegment[]>([]);
const recordingAt = ref("");
const playbackPositionAt = ref("");
let recordingTimer: ReturnType<typeof setInterval> | null = null;
const alarms = computed(() => store.alarms.filter((alarm) => alarm.bedId === route.params.bedId));

function openRecordingAt(targetAt: string): void {
  const segment = findPlaybackSegment(recordingSegments.value, targetAt, 2_000);
  if (segment) {
    recordingAt.value = targetAt;
    playbackPositionAt.value = targetAt;
  }
}

function returnToLive(): void {
  recordingAt.value = "";
  playbackPositionAt.value = "";
}

function seekRecording(targetAt: string): void {
  openRecordingAt(targetAt);
}

function selectAlarm(alarm: AlarmEnvelope): void {
  openRecordingAt(alarm.occurredAt);
}

function savePatient(input: PatientUpdateInput): void {
  if (!summary.value) return;
  store.updatePatient(summary.value.bed.id, input);
  patientEditorVisible.value = false;
  ElMessage.success("患者信息已保存");
}

function normalizeRefreshRate(): void {
  const value = Number(sensorRefreshRate.value);
  sensorRefreshRate.value = Number.isFinite(value) ? Math.min(10, Math.max(0.1, value)) : 1;
}

async function refreshRecordings(): Promise<void> {
  if (!selectedCamera.value) return;
  const start = new Date(Date.now() - store.monitoringPolicy.recordingRetentionMinutes * 60_000);
  const end = new Date(Date.now() + 60_000);
  const mediaPath = selectedCamera.value.mediaPath ?? selectedCamera.value.cameraKey;
  const query = new URLSearchParams({
    path: mediaPath,
    start: start.toISOString(),
    end: end.toISOString(),
  });

  try {
    const response = await fetch(`http://10.208.236.131:9996/list?${query}`);
    if (!response.ok) return;
    const items = (await response.json()) as MediaMtxPlaybackItem[];
    recordingSegments.value = mapMediaMtxPlaybackItems(
      items,
      mediaPath,
      "http://10.208.236.131:9996",
    );
  } catch {
    // Keep the latest successful recording index during temporary media-server outages.
  }
}

onMounted(() => {
  void refreshRecordings();
  recordingTimer = setInterval(() => void refreshRecordings(), 15_000);
});

onBeforeUnmount(() => {
  if (recordingTimer) clearInterval(recordingTimer);
});
</script>

<style scoped lang="scss">
.bed-detail {
  color: #173c3a;
}

.detail-header {
  padding: 4px 2px 20px;
  border-bottom: 1px solid #dbe6e2;
}

.detail-header__back {
  padding: 0;
  font-size: 11px;
  color: #4f756b;
  cursor: pointer;
  background: transparent;
  border: 0;

  &:focus-visible {
    outline: 2px solid #2f806a;
    outline-offset: 3px;
  }
}

.detail-header__identity {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 12px;

  span {
    font-size: 11px;
    color: #6d817b;
  }

  h1 {
    margin: 5px 0 0;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: clamp(26px, 3vw, 38px);
    font-weight: 650;
    letter-spacing: -0.04em;
  }

  small {
    display: block;
    margin-top: 6px;
    font-size: 9px;
    color: #81918c;
  }
}

.detail-header__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.patient-status {
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #2f6e60;
  background: #edf7f2;
  border: 1px solid #bfd8d0;

  &[data-status="OBSERVATION"] {
    color: #a43d34;
    background: #fff0ee;
    border-color: #e4b2ac;
  }

  &[data-status="CRITICAL"] {
    color: #fff;
    background: #a7241b;
    border-color: #a7241b;
  }
}

.detail-header__status {
  padding: 6px 9px;
  font-weight: 650;
  color: #24624f !important;
  background: #edf7f2;
  border: 1px solid #bfd8d0;
  border-radius: 3px;

  &[data-status="STALE"] {
    color: #8b611f !important;
    background: #fbf5e7;
    border-color: #e4cfaa;
  }

  &[data-status="OFFLINE"] {
    color: #66726f !important;
    background: #f2f5f4;
    border-color: #d6dfdc;
  }

  &[data-status="ALARM"] {
    color: #aa352c !important;
    background: #fff0ee;
    border-color: #e4b2ac;
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(360px, 0.9fr);
  gap: 18px;
  margin-top: 18px;
}

.video-panel,
.sensor-panel {
  padding: 20px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;

    span,
    > span {
      font-size: 11px;
      color: #71847e;
    }

    h2 {
      margin: 4px 0 0;
      font-size: 17px;
      font-weight: 650;
    }
  }
}

.video-panel__protocol {
  padding: 4px 7px;
  background: #f7faf9;
  border: 1px solid #dce6e2;
}

.detail-player {
  min-height: 440px;
  margin-top: 16px;
}

.back-to-live {
  padding: 6px 9px;
  margin-top: 8px;
  font-size: 10px;
  color: #2f6b5e;
  cursor: pointer;
  background: #f3f8f6;
  border: 1px solid #c8dcd5;
}

.sensor-contract {
  display: grid;
  gap: 5px;
  padding: 12px 14px;
  margin-top: 12px;
  background: #f5faf8;
  border-left: 3px solid #4b8b7a;

  span {
    font-size: 9px;
    font-weight: 650;
    color: #4c776d;
  }

  p {
    margin: 0;
    font-size: 11px;
    line-height: 1.65;
    color: #5e756f;
  }

  small {
    font-size: 9px;
    color: #81918c;
  }

  code {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    color: #2f665a;
    white-space: nowrap;
  }
}

.sensor-refresh {
  display: flex;
  gap: 14px;
  align-items: center;
  justify-content: space-between;
  padding: 11px 12px;
  margin-top: 14px;
  background: #fbfcfb;
  border: 1px solid #e1e9e6;

  > div:first-child {
    display: grid;
    gap: 3px;
  }

  strong {
    font-size: 10px;
    font-weight: 650;
    color: #4b6c64;
  }

  small {
    font-size: 9px;
    color: #81918c;
  }
}

.sensor-refresh__options {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 3px;

  button {
    padding: 5px 7px;
    font-family: "Avenir Next", sans-serif;
    font-size: 9px;
    color: #657b75;
    cursor: pointer;
    background: #fff;
    border: 1px solid #d3e2dc;

    &.is-active {
      font-weight: 700;
      color: #24624f;
      background: #eaf5f0;
      border-color: #4b8b7a;
    }

    &:focus-visible {
      outline: 2px solid #2f806a;
      outline-offset: 2px;
    }
  }
}

.sensor-refresh__control {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
  justify-content: flex-end;
}

.sensor-refresh__input {
  display: flex;
  align-items: center;
  height: 26px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #bfd5ce;

  &:focus-within {
    outline: 2px solid #2f806a;
    outline-offset: 1px;
  }

  input {
    width: 55px;
    padding: 4px 6px;
    font-family: "Avenir Next", sans-serif;
    font-size: 10px;
    color: #245d51;
    outline: none;
    background: transparent;
    border: 0;
  }

  span {
    padding-right: 7px;
    font-size: 9px;
    color: #71847d;
  }
}

@media (width <= 1100px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (width <= 640px) {
  .detail-header__identity {
    flex-direction: column;
    align-items: flex-start;
  }

  .detail-header__actions {
    flex-wrap: wrap;
  }

  .video-panel,
  .sensor-panel {
    padding: 14px;
  }

  .sensor-refresh {
    flex-direction: column;
    align-items: flex-start;
  }

  .sensor-refresh__control {
    justify-content: flex-start;
  }

  .detail-player {
    min-height: 280px;
  }
}
</style>
