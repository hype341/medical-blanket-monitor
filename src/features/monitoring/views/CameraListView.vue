<template>
  <div class="camera-page">
    <header class="camera-page__header">
      <div>
        <span>{{ store.hospital.name }} · 视频设备</span>
        <h1>摄像头管理</h1>
        <p>
          {{
            isDeveloper
              ? "维护摄像头名称、床位对应关系和技术接入地址。"
              : "维护摄像头名称及其对应病区、病房和床位。"
          }}
        </p>
      </div>
      <el-button type="primary" @click="openEditor()">新增摄像头</el-button>
    </header>

    <section v-if="isDeveloper" class="camera-guidance">
      <strong>标准接入，不绑定品牌</strong>
      <p>后端生成 MediaMTX 路径，前端按 WebRTC、HLS、HTTP-FLV 自动选择播放线路。</p>
    </section>

    <div v-if="isDeveloper" class="camera-link-grid">
      <CameraLinkPanel v-for="camera in store.cameras" :key="camera.id" :camera="camera" />
    </div>

    <el-table :data="tableRows" class="camera-table">
      <el-table-column prop="name" label="摄像头" min-width="180" />
      <el-table-column prop="linkedBeds" label="对应病区 / 病房 / 床位" min-width="280" />
      <el-table-column v-if="isDeveloper" prop="cameraKey" label="设备标识" min-width="170" />
      <el-table-column v-if="isDeveloper" prop="sourceProtocol" label="接入方式" width="130" />
      <el-table-column label="设备状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" effect="plain">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="isDeveloper" label="播放地址" width="120">
        <template #default="{ row }">
          <span>{{ row.playback ? "已签发" : "待接入" }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90">
        <template #default="{ row }">
          <el-button text type="primary" @click="openEditor(row.id)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <section v-if="isDeveloper" class="camera-document">
      <header>
        <div>
          <span>在线生成</span>
          <h2>视频连接文档</h2>
          <p>根据当前摄像头、病房和床位绑定关系实时生成。</p>
        </div>
        <div class="camera-document__actions">
          <el-button @click="regenerateDocument">重新生成</el-button>
          <el-button @click="copyDocument">复制文档</el-button>
          <el-button @click="downloadDocument">下载 Markdown</el-button>
          <el-button type="primary" @click="exportVideoPdf">导出 PDF</el-button>
        </div>
      </header>
      <DocumentPreview :content="videoDocument" />
    </section>

    <section v-if="isDeveloper" class="protocol-notes">
      <article>
        <span>01</span>
        <h2>RTSP 拉流</h2>
        <p>适用于支持标准 RTSP 的摄像头，地址和凭证只保存在后端。</p>
      </article>
      <article>
        <span>02</span>
        <h2>WebRTC / HLS / FLV</h2>
        <p>由 MediaMTX 统一输出，浏览器根据网络和兼容性自动降级。</p>
      </article>
      <article>
        <span>03</span>
        <h2>床位映射</h2>
        <p>摄像头不直接暴露给患者；护士只能查看授权病区关联的床位。</p>
      </article>
    </section>

    <CameraEditorDialog
      v-if="isDeveloper"
      v-model="editorVisible"
      :camera="editorCamera"
      @save="saveCamera"
    />
    <ManagedCameraDialog
      v-else
      v-model="editorVisible"
      :camera="editorCamera"
      @save="saveManagedCamera"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import CameraEditorDialog from "../components/CameraEditorDialog.vue";
import CameraLinkPanel from "../components/CameraLinkPanel.vue";
import DocumentPreview from "../components/DocumentPreview.vue";
import ManagedCameraDialog from "../components/ManagedCameraDialog.vue";
import { generateVideoDocumentation } from "../documentation";
import { useMonitoringStore } from "../store";
import type { CameraInput, CameraStatus, ManagedCameraInput } from "../types";
import { copyText } from "@/utils/clipboard";
import { printMarkdownDocument } from "@/utils/document-export";

const store = useMonitoringStore();
const isDeveloper = computed(() => store.activeRole === "DEVELOPER");
const editorVisible = ref(false);
const editingCameraId = ref("");
const generatedAt = ref(new Date().toLocaleString("zh-CN", { hour12: false }));
const videoDocument = computed(() =>
  generateVideoDocumentation(
    {
      hospital: store.hospital,
      wards: store.wards,
      rooms: store.rooms,
      beds: store.beds,
      sensors: store.sensors,
      cameras: store.cameras,
      bindings: store.bindings,
      staff: store.staff,
    },
    generatedAt.value,
  ),
);
const editorCamera = computed(
  () => store.cameras.find((camera) => camera.id === editingCameraId.value) ?? null,
);

const tableRows = computed(() =>
  store.cameras.map((camera) => {
    const linkedBeds = store.bedSummaries
      .filter((summary) => summary.cameras.some((item) => item.id === camera.id))
      .map(
        (summary) =>
          `${summary.ward?.name ?? "未分病区"} / ${summary.room?.name ?? "未分病房"} / ${summary.bed.bedNo} 床`,
      );
    return {
      ...camera,
      sourceProtocol: "待配置",
      linkedBeds: linkedBeds.join("、") || "未绑定",
    };
  }),
);

function statusLabel(status: CameraStatus): string {
  return { ONLINE: "在线", STALE: "延迟", OFFLINE: "离线" }[status];
}

function saveManagedCamera(input: ManagedCameraInput, cameraId: string | null): void {
  try {
    if (cameraId) {
      store.updateManagedCamera(cameraId, input);
    } else {
      store.addManagedCamera(input);
    }
    editorVisible.value = false;
    ElMessage.success("摄像头已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "摄像头保存失败");
  }
}

function statusType(status: CameraStatus): "success" | "warning" | "info" {
  const types = { ONLINE: "success", STALE: "warning", OFFLINE: "info" } as const;
  return types[status];
}

function openEditor(cameraId?: string): void {
  editingCameraId.value = cameraId ?? "";
  editorVisible.value = true;
}

function saveCamera(input: CameraInput, cameraId: string | null): void {
  try {
    if (cameraId) {
      store.updateCamera(cameraId, input);
    } else {
      store.addCamera(input);
    }
    editorVisible.value = false;
    ElMessage.success("摄像头已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "摄像头保存失败");
  }
}

function regenerateDocument(): void {
  generatedAt.value = new Date().toLocaleString("zh-CN", { hour12: false });
}

async function copyDocument(): Promise<void> {
  try {
    await copyText(videoDocument.value);
    ElMessage.success("视频文档已复制");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "视频文档复制失败");
  }
}

function downloadDocument(): void {
  const url = URL.createObjectURL(
    new Blob([videoDocument.value], { type: "text/markdown;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "video-connection.md";
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportVideoPdf(): void {
  try {
    printMarkdownDocument("智能毯平台视频连接文档", videoDocument.value);
    ElMessage.info("请在打印窗口中选择“另存为 PDF”");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "PDF 导出失败");
  }
}
</script>

<style scoped lang="scss">
.camera-page {
  color: #173c3a;
}

.camera-page__header {
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

.camera-guidance {
  display: flex;
  gap: 18px;
  align-items: center;
  padding: 14px 16px;
  margin: 18px 0;
  background: #eef6f3;
  border-left: 4px solid #2f806a;

  strong {
    flex-shrink: 0;
    font-size: 13px;
  }

  p {
    margin: 0;
    font-size: 12px;
    color: #627872;
  }
}

.camera-table {
  margin-top: 16px;
  border: 1px solid #dbe6e2;
}

.camera-link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 14px;
}

.camera-document {
  padding: 18px;
  margin-top: 16px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 18px;
    align-items: flex-start;
    justify-content: space-between;

    span {
      font-size: 9px;
      font-weight: 650;
      color: #4f766c;
    }

    h2 {
      margin: 4px 0;
      font-size: 16px;
    }

    p {
      margin: 0;
      font-size: 10px;
      color: #80908b;
    }
  }

  pre {
    max-height: 520px;
    padding: 16px;
    margin: 14px 0 0;
    overflow: auto;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    line-height: 1.7;
    color: #d9ebe5;
    white-space: pre-wrap;
    background: #092f2c;
  }

  .document-preview {
    margin-top: 14px;
  }
}

.camera-document__actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}

.protocol-notes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin-top: 18px;
  background: #dbe6e2;

  article {
    padding: 20px;
    background: #fff;
  }

  span {
    font-family: "Avenir Next", sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: #448574;
  }

  h2 {
    margin: 9px 0 6px;
    font-size: 14px;
    font-weight: 650;
  }

  p {
    margin: 0;
    font-size: 11px;
    line-height: 1.7;
    color: #70827d;
  }
}

@media (width <= 800px) {
  .camera-page__header,
  .camera-guidance {
    flex-direction: column;
    align-items: flex-start;
  }

  .camera-document > header {
    flex-direction: column;
  }

  .camera-document__actions {
    flex-wrap: wrap;
  }

  .protocol-notes {
    grid-template-columns: 1fr;
  }

  .camera-link-grid {
    grid-template-columns: 1fr;
  }
}
</style>
