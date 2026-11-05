<template>
  <div class="live-view">
    <header class="live-view__header">
      <div>
        <span>{{ store.hospital.name }} · 床旁视频</span>
        <h1>实时监控</h1>
        <p>摄像头按实际登记数量展示，实时画面与授权床位关联。</p>
      </div>
      <span class="live-view__count">{{ cameras.length }} 路摄像头</span>
    </header>

    <div v-if="cameras.length" class="live-grid">
      <article
        v-for="camera in cameras"
        :key="camera.id"
        class="live-camera"
        data-testid="video-tile"
      >
        <header>
          <div>
            <span>床旁视频</span>
            <h2>{{ camera.name }}</h2>
          </div>
          <span class="camera-state" :data-status="camera.status">
            {{ statusLabel(camera.status) }}
          </span>
        </header>

        <UniversalVideoPlayer
          :camera-name="camera.name"
          :camera-status="camera.status"
          :playback="camera.playback"
        />

        <footer class="live-camera__footer">
          <div>
            <span>关联床位</span>
            <strong>{{ linkedBeds(camera.id) }}</strong>
          </div>
          <div>
            <span>接入策略</span>
            <strong>RTSP / WebRTC / HLS / FLV</strong>
          </div>
          <el-button plain type="primary" @click="router.push('/devices/bindings')">
            调整床位绑定
          </el-button>
        </footer>
      </article>
    </div>

    <el-empty v-else description="系统中尚未登记摄像头">
      <el-button type="primary" @click="router.push('/devices/bindings')">去配置绑定</el-button>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import UniversalVideoPlayer from "@/components/UniversalVideoPlayer/index.vue";
import { useMonitoringStore } from "../store";

const router = useRouter();
const store = useMonitoringStore();
const cameras = computed(() => store.cameras);

function statusLabel(status: "ONLINE" | "OFFLINE" | "STALE"): string {
  const labels = { ONLINE: "设备在线", STALE: "连接延迟", OFFLINE: "设备离线" };
  return labels[status];
}

function linkedBeds(cameraId: string): string {
  const bedIds = new Set(
    store.bedSummaries
      .filter((summary) => summary.cameras.some((item) => item.id === cameraId))
      .map((summary) => summary.bed.id),
  );
  const labels = store.bedSummaries
    .filter((summary) => bedIds.has(summary.bed.id))
    .map((summary) => `${summary.room?.roomNo ?? ""} 房 ${summary.bed.bedNo} 床`);
  return labels.length ? labels.join("、") : "尚未绑定";
}
</script>

<style scoped lang="scss">
.live-view {
  color: #173c3a;
}

.live-view__header {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 6px 2px 20px;
  border-bottom: 1px solid #dbe6e2;

  span {
    font-size: 11px;
    font-weight: 650;
    color: #4b766c;
    letter-spacing: 0.06em;
  }

  h1 {
    margin: 5px 0 4px;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: clamp(28px, 3vw, 40px);
    font-weight: 650;
    letter-spacing: -0.04em;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: #6e817c;
  }
}

.live-view__count {
  padding: 5px 8px;
  color: #2f6e60 !important;
  background: #eef6f3;
  border: 1px solid #c5dcd5;
}

.live-camera {
  padding: 20px;
  margin-top: 18px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 14px;

    span {
      font-size: 10px;
      color: #71847e;
    }

    h2 {
      margin: 4px 0 0;
      font-size: 17px;
      font-weight: 650;
    }
  }
}

.live-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 14px;
}

.camera-state {
  padding: 5px 8px;
  font-weight: 650;
  color: #24624f !important;
  background: #edf7f2;
  border: 1px solid #bfd8d0;

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
}

.live-camera__footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 24px;
  align-items: center;
  padding-top: 14px;
  margin-top: 14px;
  border-top: 1px solid #e5ece9;

  div {
    display: grid;
    gap: 4px;
  }

  span {
    font-size: 10px;
    color: #7a8b86;
  }

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
    font-weight: 600;
    color: #264f47;
    white-space: nowrap;
  }
}

@media (width <= 760px) {
  .live-grid {
    grid-template-columns: 1fr;
  }

  .live-camera {
    padding: 14px;
  }

  .live-camera__footer {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
