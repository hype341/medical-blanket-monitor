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
      <div class="camera-page__header-actions">
        <el-button v-if="isDeveloper" @click="downloadCameraTemplate">下载模板</el-button>
        <el-button v-if="isDeveloper" @click="bulkDialogVisible = true">批量导入</el-button>
        <el-button type="primary" @click="openEditor()">新增摄像头</el-button>
      </div>
    </header>

    <section v-if="isDeveloper" class="camera-guidance">
      <strong>标准接入，不绑定品牌</strong>
      <p>后端生成 MediaMTX 路径，前端按 WebRTC、HLS、HTTP-FLV 自动选择播放线路。</p>
    </section>

    <section class="camera-filters" aria-label="摄像头筛选">
      <el-input
        v-model="query"
        clearable
        placeholder="搜索摄像头名称、设备标识、病房或床位"
      />
      <el-select v-model="statusFilter" aria-label="摄像头状态">
        <el-option label="全部状态" value="ALL" />
        <el-option label="在线" value="ONLINE" />
        <el-option label="延迟" value="STALE" />
        <el-option label="离线" value="OFFLINE" />
      </el-select>
      <span>已筛选 {{ filteredRows.length }} / {{ tableRows.length }} 台</span>
    </section>

    <div v-if="isDeveloper" class="camera-link-grid">
      <CameraLinkPanel v-for="camera in pagedCameras" :key="camera.id" :camera="camera" />
    </div>

    <el-table :data="pagedRows" class="camera-table">
      <el-table-column prop="name" label="摄像头" min-width="180" />
      <el-table-column prop="linkedBeds" label="对应病区 / 病房 / 床位" min-width="280" />
      <el-table-column v-if="isDeveloper" prop="cameraKey" label="设备标识" min-width="170" />
      <el-table-column v-if="isDeveloper" prop="sourceProtocol" label="接入方式" width="130" />
      <el-table-column label="设备状态" width="110">
        <template #default="{ row }">
          <span class="camera-status-tag" :data-status="row.status">
            {{ statusLabel(row.status) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column v-if="isDeveloper" label="播放地址" width="120">
        <template #default="{ row }">
          <span>{{ row.playback ? "已签发" : "待接入" }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130">
        <template #default="{ row }">
          <el-button text type="primary" @click="openEditor(row.id)">编辑</el-button>
          <el-button text type="danger" @click="confirmDeleteCamera(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <footer v-if="filteredRows.length" class="camera-table-footer">
      <span>视频列表采用按需加载，只有打开床位详情时才建立播放连接。</span>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[12, 24, 48, 96]"
        :total="filteredRows.length"
        layout="sizes, prev, pager, next"
        background
      />
    </footer>

    <section v-if="isDeveloper" class="camera-document">
      <header>
        <div>
          <span>在线生成</span>
          <h2>视频连接文档</h2>
          <p>根据当前摄像头、病房和床位绑定关系实时生成。</p>
        </div>
        <div class="camera-document__actions">
          <el-button v-if="!showVideoDocument" @click="regenerateDocument">生成文档</el-button>
          <el-button v-else @click="regenerateDocument">重新生成</el-button>
          <el-button @click="copyDocument">复制文档</el-button>
          <el-button @click="downloadDocument">下载 Markdown</el-button>
          <el-button type="primary" @click="exportVideoPdf">导出 PDF</el-button>
        </div>
      </header>
      <DocumentPreview v-if="showVideoDocument" :content="videoDocument" />
      <div v-else class="camera-document__idle">
        设备较多时文档按需生成，避免一次载入全部摄像头说明影响页面速度。
      </div>
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

    <el-dialog v-model="bulkDialogVisible" title="批量导入摄像头" width="720px">
      <div class="camera-bulk-import">
        <p>
          CSV 每行一台摄像头，字段顺序为：名称、设备标识、媒体路径、流媒体节点地址、厂商、型号。
          媒体路径可留空，系统会根据设备标识自动生成。
        </p>
        <div class="camera-bulk-import__actions">
          <el-button @click="cameraImportInput?.click()">选择 CSV 文件</el-button>
          <span>单次最多 10000 台</span>
        </div>
        <el-input
          v-model="cameraImportText"
          type="textarea"
          :rows="10"
          placeholder="摄像头名称,设备标识,媒体路径,流媒体节点地址,厂商,型号"
        />
        <input
          ref="cameraImportInput"
          class="visually-hidden"
          type="file"
          accept=".csv,text/csv,text/plain"
          @change="loadCameraImportFile"
        />
      </div>
      <template #footer>
        <el-button @click="bulkDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!cameraImportText.trim()" @click="importCameras">
          导入摄像头
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import CameraEditorDialog from "../components/CameraEditorDialog.vue";
import CameraLinkPanel from "../components/CameraLinkPanel.vue";
import DocumentPreview from "../components/DocumentPreview.vue";
import ManagedCameraDialog from "../components/ManagedCameraDialog.vue";
import { generateVideoDocumentation } from "../documentation";
import { useMonitoringStore } from "../store";
import type { CameraInput, CameraStatus, ManagedCameraInput } from "../types";
import { copyText } from "@/utils/clipboard";
import { printMarkdownDocument } from "@/utils/document-export";
import { probeCameraHealth } from "../camera-health";

const store = useMonitoringStore();
const isDeveloper = computed(() => store.activeRole === "DEVELOPER");
const editorVisible = ref(false);
const editingCameraId = ref("");
const query = ref("");
const statusFilter = ref<"ALL" | CameraStatus>("ALL");
const currentPage = ref(1);
const pageSize = ref(12);
const showVideoDocument = ref(false);
const bulkDialogVisible = ref(false);
const cameraImportText = ref("");
const cameraImportInput = ref<HTMLInputElement>();
let healthTimer: ReturnType<typeof setInterval> | null = null;
let healthController: AbortController | null = null;
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

const linkedBedLocations = computed(() => {
  const result = new Map<string, string[]>();
  for (const summary of store.bedSummaries) {
    const location = `${summary.ward?.name ?? "未分病区"} / ${summary.room?.name ?? "未分病房"} / ${summary.bed.bedNo} 床`;
    for (const camera of summary.cameras) {
      const locations = result.get(camera.id) ?? [];
      locations.push(location);
      result.set(camera.id, locations);
    }
  }
  return result;
});

const tableRows = computed(() =>
  store.cameras.map((camera) => {
    const linkedBeds = linkedBedLocations.value.get(camera.id) ?? [];
    return {
      ...camera,
      sourceProtocol: "待配置",
      linkedBeds: linkedBeds.join("、") || "未绑定",
    };
  }),
);
const filteredRows = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  return tableRows.value.filter((row) => {
    if (statusFilter.value !== "ALL" && row.status !== statusFilter.value) return false;
    if (!keyword) return true;
    return [row.name, row.cameraKey, row.linkedBeds]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(keyword));
  });
});
const pageStart = computed(() => (currentPage.value - 1) * pageSize.value);
const pagedRows = computed(() =>
  filteredRows.value.slice(pageStart.value, pageStart.value + pageSize.value),
);
const pagedCameras = computed(() => {
  const ids = new Set(pagedRows.value.map((camera) => camera.id));
  return store.cameras.filter((camera) => ids.has(camera.id));
});

watch([query, statusFilter, pageSize], () => {
  currentPage.value = 1;
});

async function refreshCameraHealth(): Promise<void> {
  if (document.visibilityState !== "visible" || !pagedCameras.value.length) return;
  healthController?.abort();
  healthController = new AbortController();
  try {
    const results = await probeCameraHealth(pagedCameras.value, healthController.signal);
    results.forEach((result) => store.syncCameraStatus(result.cameraId, result.status));
  } catch {
    // Keep the last known state when the status endpoint is temporarily unavailable.
  }
}

watch(
  () => pagedCameras.value.map((camera) => camera.id).join(","),
  () => void refreshCameraHealth(),
);

onMounted(() => {
  void refreshCameraHealth();
  healthTimer = setInterval(() => void refreshCameraHealth(), 20_000);
});

onBeforeUnmount(() => {
  healthController?.abort();
  if (healthTimer) clearInterval(healthTimer);
});

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

function openEditor(cameraId?: string): void {
  editingCameraId.value = cameraId ?? "";
  editorVisible.value = true;
}

function downloadCameraTemplate(): void {
  const content =
    "name,cameraKey,mediaPath,mediaServerUrl,vendor,model\n" +
    "301病房摄像头,camera-301,camera-301,http://172.20.10.10,通用,IMX219\n";
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "camera-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function loadCameraImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  cameraImportText.value = await file.text();
}

function importCameras(): void {
  try {
    const rows = parseCameraCsv(cameraImportText.value);
    const imported = store.addCameraBatch(rows);
    cameraImportText.value = "";
    bulkDialogVisible.value = false;
    ElMessage.success(`已导入 ${imported} 台摄像头`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "摄像头批量导入失败");
  }
}

function parseCameraCsv(content: string): CameraInput[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) throw new Error("CSV 内容为空");
  const first = splitCsvLine(lines[0]);
  if (first[0]?.toLowerCase() === "name" || first[0] === "名称") lines.shift();

  return lines.map((line) => {
    const [name = "", cameraKey = "", mediaPath = "", mediaServerUrl = "", vendor = "", model = ""] =
      splitCsvLine(line);
    const normalizedKey = cameraKey.trim();
    const generatedPath = normalizedKey
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return {
      name: name.trim(),
      cameraKey: normalizedKey,
      mediaPath: mediaPath.trim() || generatedPath,
      mediaServerUrl: mediaServerUrl.trim() || undefined,
      vendor: vendor.trim() || undefined,
      model: model.trim() || undefined,
    };
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current);
  return cells;
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

async function confirmDeleteCamera(cameraId: string): Promise<void> {
  const camera = store.cameras.find((item) => item.id === cameraId);
  if (!camera) return;
  try {
    await ElMessageBox.confirm(
      `确定删除“${camera.name}”吗？对应床位的摄像头绑定会自动解除。`,
      "删除摄像头",
      {
        confirmButtonText: "删除摄像头",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    store.deleteCamera(cameraId);
    ElMessage.success("摄像头已删除");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "摄像头删除失败");
  }
}

function regenerateDocument(): void {
  generatedAt.value = new Date().toLocaleString("zh-CN", { hour12: false });
  showVideoDocument.value = true;
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

  :deep(small) {
    font-size: 11px;
    line-height: 1.55;
  }
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

.camera-page__header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
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

.camera-bulk-import {
  display: grid;
  gap: 12px;

  p {
    margin: 0;
    font-size: 12px;
    line-height: 1.7;
    color: #657a73;
  }
}

.camera-bulk-import__actions {
  display: flex;
  gap: 12px;
  align-items: center;

  span {
    font-size: 11px;
    color: #7b8c87;
  }
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}

.camera-status-tag {
  display: inline-flex;
  align-items: center;
  min-width: 48px;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  color: #5d6d69;
  background: #f3f6f5;
  border: 1px solid #d7e0dc;

  &[data-status="ONLINE"] {
    color: #24624f;
    background: #edf7f2;
    border-color: #bfd8d0;
  }

  &[data-status="STALE"] {
    color: #8b611f;
    background: #fbf5e7;
    border-color: #e4cfaa;
  }

  &[data-status="OFFLINE"] {
    color: #66726f;
    background: #f2f5f4;
    border-color: #d6dfdc;
  }
}

.camera-filters {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 14px;
  margin-top: 14px;
  background: #fff;
  border: 1px solid #dbe6e2;

  .el-input {
    max-width: 460px;
  }

  .el-select {
    width: 140px;
  }

  > span {
    margin-left: auto;
    font-size: 11px;
    color: #71847e;
  }
}

.camera-link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 14px;
}

.camera-table-footer {
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;

  > span {
    font-size: 11px;
    color: #71847e;
  }
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

.camera-document__idle {
  padding: 18px;
  margin-top: 14px;
  font-size: 12px;
  color: #6f827c;
  background: #f6faf8;
  border: 1px dashed #c6d9d2;
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

  .camera-filters,
  .camera-table-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .camera-filters .el-input,
  .camera-filters .el-select {
    width: 100%;
    max-width: none;
  }

  .camera-filters > span {
    margin-left: 0;
  }
}
</style>
