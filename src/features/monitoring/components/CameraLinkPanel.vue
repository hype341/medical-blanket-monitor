<template>
  <section class="camera-links" :data-compact="compact">
    <header>
      <div>
        <span>视频直连地址</span>
        <h3>{{ camera?.name ?? "尚未绑定摄像头" }}</h3>
      </div>
      <small>点击复制后可直接交给浏览器或播放器</small>
    </header>

    <div v-if="camera" class="camera-links__list">
      <article v-for="link in links" :key="link.label" :data-primary="link.primary">
        <div>
          <span>{{ link.label }}</span>
          <code :title="link.url">{{ link.url }}</code>
        </div>
        <div class="camera-links__actions">
          <el-button v-if="link.openable" text @click="openLink(link.url)">打开</el-button>
          <el-button text type="primary" @click="copyLink(link)">复制</el-button>
        </div>
      </article>
    </div>

    <div v-else class="camera-links__empty">完成摄像头与床位绑定后显示播放地址。</div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import { copyText } from "@/utils/clipboard";
import type { Camera } from "../types";
import { getCameraMediaEndpoints } from "../media-endpoints";

interface CameraLink {
  label: string;
  url: string;
  primary?: boolean;
  openable?: boolean;
}

const props = withDefaults(
  defineProps<{
    camera: Camera | null;
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const endpoints = computed(() =>
  props.camera ? getCameraMediaEndpoints(props.camera) : null,
);

const links = computed<CameraLink[]>(() => {
  if (!props.camera) return [];
  if (!endpoints.value) return [];
  const start = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  const end = new Date(Date.now() + 60_000).toISOString();
  const playbackQuery = new URLSearchParams({
    path: endpoints.value.mediaPath,
    start,
    end,
  });

  return [
    {
      label: "WebRTC 浏览器观看",
      url: endpoints.value.webRtcViewUrl,
      primary: true,
      openable: true,
    },
    { label: "HLS", url: endpoints.value.hlsUrl, openable: true },
    {
      label: "摄像头推流地址",
      url: endpoints.value.rtmpUrl,
    },
    {
      label: "RTSP 流",
      url: endpoints.value.rtspUrl,
    },
    {
      label: "最近 2 小时回放索引",
      url: `${endpoints.value.playbackApiBaseUrl}/list?${playbackQuery}`,
      openable: true,
    },
  ];
});

function openLink(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyLink(link: CameraLink): Promise<void> {
  try {
    await copyText(link.url);
    ElMessage.success(`${link.label}已复制`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "链接复制失败");
  }
}
</script>

<style scoped lang="scss">
.camera-links {
  padding: 16px;
  margin-top: 14px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px solid #e4ece9;

    span,
    small {
      font-size: 9px;
      color: #7d8e89;
    }

    h3 {
      margin: 4px 0 0;
      font-size: 14px;
      font-weight: 680;
    }
  }
}

.camera-links__list {
  display: grid;
  gap: 7px;
  margin-top: 10px;

  article {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 10px 11px;
    background: #f8fbfa;
    border: 1px solid #e3ebe8;

    &[data-primary="true"] {
      background: #edf7f2;
      border-color: #c4ddd5;
    }
  }

  article > div:first-child {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  span {
    font-size: 9px;
    font-weight: 650;
    color: #526f67;
  }

  code {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    color: #32695c;
    white-space: nowrap;
  }
}

.camera-links__actions {
  display: flex;
  gap: 2px;
}

.camera-links__empty {
  padding: 12px;
  margin-top: 10px;
  font-size: 10px;
  color: #7d8e89;
  background: #f8fbfa;
  border-left: 3px solid #c8d9d2;
}

.camera-links[data-compact="true"] {
  padding: 0;
  margin-top: 10px;
  border: 0;

  > header {
    display: none;
  }
}

@media (width <= 640px) {
  .camera-links > header {
    flex-direction: column;
  }

  .camera-links__list article {
    grid-template-columns: 1fr;
  }

  .camera-links__actions {
    justify-self: start;
  }
}
</style>
