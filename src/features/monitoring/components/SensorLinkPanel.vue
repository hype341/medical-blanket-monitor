<template>
  <section class="sensor-links" :data-compact="compact">
    <header>
      <div>
        <span>传感器数据入口</span>
        <h3>{{ summary?.sensor?.name ?? "尚未绑定传感器" }}</h3>
      </div>
      <small>链接可直接交给页面或第三方服务</small>
    </header>

    <div class="sensor-links__view-switch" aria-label="传感器数据链接显示方式">
      <span>数据视图</span>
      <button
        type="button"
        :class="{ 'is-active': viewMode === 'data' }"
        @click="viewMode = 'data'"
      >
        1792 字节数据
      </button>
      <button
        type="button"
        :class="{ 'is-active': viewMode === 'raw' }"
        @click="viewMode = 'raw'"
      >
        原始帧
      </button>
      <button
        type="button"
        :class="{ 'is-active': viewMode === 'full' }"
        @click="viewMode = 'full'"
      >
        完整报文
      </button>
    </div>

    <div v-if="summary?.dataTopic && activeLink" class="sensor-links__list">
      <article data-primary="true">
        <div>
          <span>{{ activeLink.label }}</span>
          <code :title="activeLink.url">{{ activeLink.url }}</code>
        </div>
        <div class="sensor-links__actions">
          <el-button text @click="openLink(activeLink.url)">打开</el-button>
          <el-button text type="primary" @click="copyLink(activeLink)">复制</el-button>
        </div>
      </article>
    </div>

    <div v-else class="sensor-links__empty">绑定毯子传感器后生成数据入口。</div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { copyText } from "@/utils/clipboard";
import {
  buildSensorDataApiPath,
  buildSensorHexApiPath,
} from "../messaging";
import type { BedMonitorSummary, MqttSettings } from "../types";

interface SensorLink {
  label: string;
  url: string;
  primary?: boolean;
  openable?: boolean;
}

const props = withDefaults(
  defineProps<{
    summary: BedMonitorSummary | null;
    settings: MqttSettings;
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);
const viewMode = ref<"data" | "raw" | "full">("data");

const activeLink = computed<SensorLink | null>(() => {
  if (!props.summary?.dataTopic) return null;
  const origin = window.location.origin;
  if (viewMode.value === "raw") {
    return {
      label: "传感器原始帧",
      url: `${origin}/api/public/sensors/${encodeURIComponent(props.summary.bed.id)}/raw-hex`,
    };
  }
  if (viewMode.value === "full") {
    return {
      label: "传感器完整报文",
      url: `${origin}${buildSensorDataApiPath(props.summary.bed.id)}`,
    };
  }
  return {
    label: "传感器 1792 字节数据",
    url: `${origin}${buildSensorHexApiPath(props.summary.bed.id)}`,
  };
});

function openLink(url: string): void {
  if (new URL(url, window.location.origin).origin === window.location.origin) {
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyLink(link: SensorLink): Promise<void> {
  try {
    await copyText(link.url);
    ElMessage.success(`${link.label}已复制`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "链接复制失败");
  }
}
</script>

<style scoped lang="scss">
.sensor-links {
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

.sensor-links__list {
  display: grid;
  gap: 7px;
  margin-top: 10px;

  article {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 9px 10px;
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

.sensor-links__view-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  padding: 8px 10px;
  margin-top: 9px;
  background: #f6faf8;
  border: 1px solid #dfe9e5;

  > span {
    margin-right: 4px;
    font-size: 10px;
    color: #70837c;
  }

  button {
    padding: 5px 8px;
    font-size: 10px;
    color: #55716a;
    cursor: pointer;
    background: #fff;
    border: 1px solid #d1dfda;

    &.is-active {
      font-weight: 700;
      color: #fff;
      background: #2f806a;
      border-color: #2f806a;
    }

    &:focus-visible {
      outline: 2px solid #2f806a;
      outline-offset: 2px;
    }
  }
}

.sensor-links__actions {
  display: flex;
  gap: 2px;
}

.sensor-links__empty {
  padding: 12px;
  margin-top: 10px;
  font-size: 10px;
  color: #7d8e89;
  background: #f8fbfa;
  border-left: 3px solid #c8d9d2;
}

.sensor-links[data-compact="true"] {
  padding: 0;
  margin-top: 10px;
  border: 0;

  > header {
    display: none;
  }
}

@media (width <= 640px) {
  .sensor-links > header {
    flex-direction: column;
  }

  .sensor-links__list article {
    grid-template-columns: 1fr;
  }

  .sensor-links__actions {
    justify-self: start;
  }
}
</style>
