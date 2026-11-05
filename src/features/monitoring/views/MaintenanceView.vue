<template>
  <div class="maintenance-page">
    <header class="maintenance-header">
      <div>
        <span class="maintenance-header__eyebrow">开发者工具 · 运行保障</span>
        <h1>维护中心</h1>
        <p>集中检查服务状态、核对数据完整性，并在升级或排障前备份平台配置。</p>
      </div>
      <div class="maintenance-header__actions">
        <el-button :loading="checking" @click="runDiagnostics">重新检查</el-button>
        <el-button type="primary" @click="downloadReport">下载维护报告</el-button>
      </div>
    </header>

    <section class="maintenance-command" aria-label="维护状态摘要">
      <div class="maintenance-command__summary" :data-status="overallStatus">
        <span class="maintenance-command__mark" />
        <div>
          <small>系统检查结论</small>
          <strong>{{ overallLabel }}</strong>
          <p>{{ lastCheckedLabel }}</p>
        </div>
      </div>
      <dl>
        <div>
          <dt>业务数据</dt>
          <dd>浏览器自动保存</dd>
        </div>
        <div>
          <dt>告警状态</dt>
          <dd>服务端持久化</dd>
        </div>
        <div>
          <dt>配置备份</dt>
          <dd>不含 MQTT 密码</dd>
        </div>
      </dl>
    </section>

    <div class="maintenance-grid">
      <section class="maintenance-panel maintenance-panel--health">
        <header>
          <div>
            <span>实时诊断</span>
            <h2>系统健康</h2>
          </div>
          <span class="maintenance-panel__meta">{{ passedCheckCount }}/{{ checks.length }} 通过</span>
        </header>

        <div class="diagnostic-list">
          <article
            v-for="check in checks"
            :key="check.id"
            class="diagnostic-row"
            :data-status="check.status"
          >
            <span class="diagnostic-row__dot" />
            <div>
              <strong>{{ check.label }}</strong>
              <p>{{ check.detail }}</p>
            </div>
            <small>{{ check.latencyMs === null ? "等待" : `${check.latencyMs} ms` }}</small>
          </article>
        </div>
      </section>

      <section class="maintenance-panel maintenance-panel--data">
        <header>
          <div>
            <span>数据核对</span>
            <h2>当前运行规模</h2>
          </div>
          <span class="maintenance-panel__meta">自动刷新数据</span>
        </header>

        <div class="data-metrics">
          <article v-for="metric in dataMetrics" :key="metric.label">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.note }}</small>
          </article>
        </div>

        <div class="maintenance-notes">
          <div>
            <strong>需要人工确认</strong>
            <p>{{ manualReviewText }}</p>
          </div>
          <button type="button" @click="openBedMonitoring">进入床位列表核对</button>
        </div>
      </section>

      <section class="maintenance-panel maintenance-panel--backup">
        <header>
          <div>
            <span>配置保护</span>
            <h2>备份与恢复</h2>
          </div>
          <span class="maintenance-panel__meta">JSON · 版本 {{ backupVersion }}</span>
        </header>

        <p class="maintenance-panel__description">
          备份包含病区、病房、床位、患者、设备绑定、人员权限、账号密码摘要、平台名称和
          MQTT 连接参数。MQTT 密码不会写入文件，恢复后沿用当前密码。
        </p>

        <div class="backup-actions">
          <button type="button" class="backup-action" @click="exportConfiguration">
            <span>导出配置备份</span>
            <strong>下载 JSON</strong>
            <small>升级或迁移前保存当前业务配置</small>
          </button>
          <button type="button" class="backup-action" @click="fileInput?.click()">
            <span>恢复配置备份</span>
            <strong>选择文件</strong>
            <small>恢复前会二次确认，并替换当前业务配置</small>
          </button>
          <button type="button" class="backup-action" @click="copyDiagnosticReport">
            <span>复制诊断摘要</span>
            <strong>发送给维护人员</strong>
            <small>包含健康状态、数据量和接口耗时</small>
          </button>
        </div>
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept="application/json,.json"
          @change="importConfiguration"
        />
      </section>

      <section class="maintenance-panel maintenance-panel--guide">
        <header>
          <div>
            <span>操作规范</span>
            <h2>上线前检查清单</h2>
          </div>
          <span class="maintenance-panel__meta">建议每次升级执行</span>
        </header>

        <ol class="maintenance-checklist">
          <li>
            <span>01</span>
            <div>
              <strong>确认 MQTT 与视频服务在线</strong>
              <p>健康检查应全部通过，再用设备发送一条测试数据。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>验证病床告警全链路</strong>
              <p>检查标红、提醒、跳转回放、标记解决和删除是否同步。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>导出配置并核对人员权限</strong>
              <p>管理员与开发者权限保持分离，新增账号只开放必要模块。</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { useMonitoringStore } from "../store";
import type { MonitoringBackup } from "../store";
import { copyText } from "@/utils/clipboard";
import { probeCameraHealth } from "../camera-health";

type CheckStatus = "pending" | "pass" | "fail";

interface DiagnosticCheck {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
  latencyMs: number | null;
}

interface HealthResponse {
  status?: string;
  mqttConnected?: boolean;
  uptimeSeconds?: number;
  sensorCount?: number;
  alarmCount?: number;
  openAlarmCount?: number;
}

const router = useRouter();
const store = useMonitoringStore();
const checking = ref(false);
const lastCheckedAt = ref<Date | null>(null);
const fileInput = ref<HTMLInputElement>();
const backupVersion = 1;
const checks = ref<DiagnosticCheck[]>([
  {
    id: "backend",
    label: "Spring API",
    detail: "等待检查",
    status: "pending",
    latencyMs: null,
  },
  {
    id: "mqtt",
    label: "MQTT 数据管线",
    detail: "等待检查",
    status: "pending",
    latencyMs: null,
  },
  {
    id: "sensors",
    label: "传感器快照接口",
    detail: "等待检查",
    status: "pending",
    latencyMs: null,
  },
  {
    id: "alarms",
    label: "告警查询接口",
    detail: "等待检查",
    status: "pending",
    latencyMs: null,
  },
  {
    id: "camera",
    label: "视频流媒体节点",
    detail: "等待检查",
    status: "pending",
    latencyMs: null,
  },
]);

const passedCheckCount = computed(
  () => checks.value.filter((check) => check.status === "pass").length,
);
const overallStatus = computed(() => {
  if (checking.value || checks.value.some((check) => check.status === "pending")) return "pending";
  return checks.value.every((check) => check.status === "pass") ? "pass" : "fail";
});
const overallLabel = computed(() => {
  if (overallStatus.value === "pass") return "运行正常";
  if (overallStatus.value === "fail") return "存在需要处理的检查项";
  return "正在检查";
});
const lastCheckedLabel = computed(() =>
  lastCheckedAt.value
    ? `最近检查 ${new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(lastCheckedAt.value)}`
    : "进入页面后自动检查",
);
const dataMetrics = computed(() => [
  { label: "病区 / 病房", value: `${store.wards.length} / ${store.rooms.length}`, note: "组织结构" },
  { label: "监护床位", value: store.beds.length, note: `${store.currentWards.length} 个授权病区` },
  { label: "毯子传感器", value: store.sensors.length, note: "已登记设备" },
  { label: "摄像头", value: store.cameras.length, note: "视频管线设备" },
  { label: "未处理告警", value: store.openAlarmCount, note: "需医护确认" },
  { label: "待补绑定", value: store.unboundBedCount, note: "传感器或摄像头缺失" },
]);
const manualReviewText = computed(() =>
  store.unboundBedCount || store.openAlarmCount
    ? `当前有 ${store.openAlarmCount} 条未处理告警、${store.unboundBedCount} 张床位存在设备缺口，请进入床位列表逐项核对。`
    : "当前未发现未处理告警或设备绑定缺口，可继续按计划执行巡检。",
);

function updateCheck(
  id: string,
  status: CheckStatus,
  detail: string,
  latencyMs: number | null,
): void {
  const target = checks.value.find((check) => check.id === id);
  if (target) Object.assign(target, { status, detail, latencyMs });
}

async function timedFetch(url: string): Promise<{ response: Response; latencyMs: number }> {
  const startedAt = performance.now();
  const response = await fetch(url, { cache: "no-store" });
  return { response, latencyMs: Math.round(performance.now() - startedAt) };
}

async function runDiagnostics(): Promise<void> {
  if (checking.value) return;
  checking.value = true;
  checks.value.forEach((check) => {
    check.status = "pending";
    check.detail = "正在检查";
    check.latencyMs = null;
  });

  try {
    const healthResult = await timedFetch("/api/health");
    if (!healthResult.response.ok) throw new Error(`HTTP ${healthResult.response.status}`);
    const health = (await healthResult.response.json()) as HealthResponse;
    updateCheck(
      "backend",
      "pass",
      `服务运行 ${formatDuration(health.uptimeSeconds)} · 已存 ${health.alarmCount ?? 0} 条告警`,
      healthResult.latencyMs,
    );
    updateCheck(
      "mqtt",
      health.mqttConnected ? "pass" : "fail",
      health.mqttConnected ? "Broker 已连接，可接收设备数据与告警" : "Broker 未连接，请检查网络和账号",
      healthResult.latencyMs,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "无法访问服务";
    updateCheck("backend", "fail", detail, null);
    updateCheck("mqtt", "fail", "无法读取 MQTT 连接状态", null);
  }

  await Promise.all([
    checkEndpoint("sensors", "/api/public/sensors", "传感器快照接口可读取"),
    checkEndpoint("alarms", "/api/public/alarms", "告警接口可读取"),
    checkCameraMedia(),
  ]);

  lastCheckedAt.value = new Date();
  checking.value = false;
}

async function checkCameraMedia(): Promise<void> {
  const camera = store.cameras[0];
  if (!camera) {
    updateCheck("camera", "pass", "当前尚未配置摄像头", 0);
    return;
  }
  try {
    const [result] = await probeCameraHealth([camera]);
    updateCheck(
      "camera",
      result?.status === "ONLINE" ? "pass" : "fail",
      result?.detail || "未返回摄像头状态",
      result?.latencyMs ?? null,
    );
  } catch (error) {
    updateCheck("camera", "fail", error instanceof Error ? error.message : "摄像头接口访问失败", null);
  }
}

async function checkEndpoint(id: string, url: string, successDetail: string): Promise<void> {
  try {
    const { response, latencyMs } = await timedFetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    updateCheck(id, "pass", successDetail, latencyMs);
  } catch (error) {
    updateCheck(id, "fail", error instanceof Error ? error.message : "接口访问失败", null);
  }
}

function formatDuration(seconds: number | undefined): string {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${value} 秒`;
  if (value < 3_600) return `${Math.floor(value / 60)} 分钟`;
  return `${Math.floor(value / 3_600)} 小时`;
}

function buildReport(): Record<string, unknown> {
  return {
    schemaVersion: backupVersion,
    generatedAt: new Date().toISOString(),
    platform: store.platformName,
    hospital: store.hospital.name,
    role: store.activeRole,
    account: store.activeUsername,
    checks: checks.value,
    counts: {
      wards: store.wards.length,
      rooms: store.rooms.length,
      beds: store.beds.length,
      sensors: store.sensors.length,
      cameras: store.cameras.length,
      openAlarms: store.openAlarmCount,
      unboundBeds: store.unboundBedCount,
    },
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
    },
  };
}

function downloadJson(fileName: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadReport(): void {
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  downloadJson(`medical-blanket-diagnostics-${stamp}.json`, buildReport());
  ElMessage.success("维护报告已下载");
}

function exportConfiguration(): void {
  try {
    const backup = store.buildMonitoringBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`medical-blanket-backup-${stamp}.json`, backup);
    ElMessage.success("配置备份已导出");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "配置备份导出失败");
  }
}

async function importConfiguration(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const content = await file.text();
    const parsed = JSON.parse(content) as Partial<MonitoringBackup>;
    await ElMessageBox.confirm(
      `将恢复 ${parsed.data?.beds?.length ?? 0} 张床位、${parsed.data?.staff?.length ?? 0} 个账号的配置。当前业务配置会被替换，是否继续？`,
      "确认恢复配置",
      {
        confirmButtonText: "恢复配置",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    store.restoreMonitoringBackup(content);
    ElMessage.success("配置已恢复，并已重新写入浏览器自动保存");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "配置恢复失败");
  }
}

async function copyDiagnosticReport(): Promise<void> {
  try {
    await copyText(JSON.stringify(buildReport(), null, 2));
    ElMessage.success("诊断摘要已复制");
  } catch {
    ElMessage.error("无法写入剪贴板，请改用下载维护报告");
  }
}

function openBedMonitoring(): void {
  void router.push("/beds");
}

onMounted(runDiagnostics);
</script>

<style scoped lang="scss">
.maintenance-page {
  color: #173c3a;
}

.maintenance-header {
  display: flex;
  gap: 24px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 8px 2px 24px;
  border-bottom: 1px solid #dbe6e2;

  h1 {
    margin: 6px 0 5px;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: clamp(30px, 3vw, 42px);
    font-weight: 650;
    line-height: 1.05;
    letter-spacing: -0.045em;
  }

  p {
    max-width: 720px;
    margin: 0;
    font-size: 14px;
    line-height: 1.65;
    color: #697d77;
  }
}

.maintenance-header__eyebrow {
  font-size: 12px;
  font-weight: 700;
  color: #347363;
  letter-spacing: 0.06em;
}

.maintenance-header__actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.maintenance-command {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.2fr);
  gap: 1px;
  margin-top: 18px;
  overflow: hidden;
  background: #dce7e2;
  border: 1px solid #d7e3df;
}

.maintenance-command__summary {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 20px 22px;
  color: #f4fbf8;
  background: #0d4440;

  &[data-status="fail"] {
    background: #74342f;
  }

  small,
  p {
    color: rgb(255 255 255 / 66%);
  }

  strong {
    display: block;
    margin: 3px 0;
    font-size: 20px;
  }

  p {
    margin: 0;
    font-size: 11px;
  }
}

.maintenance-command__mark {
  width: 9px;
  height: 48px;
  background: #85d4b8;
  border-radius: 99px;
}

.maintenance-command__summary[data-status="fail"] .maintenance-command__mark {
  background: #ffb1a9;
}

.maintenance-command dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  background: #fff;

  div {
    display: grid;
    gap: 4px;
    align-content: center;
    padding: 18px 20px;
    border-right: 1px solid #e3ebe8;

    &:last-child {
      border-right: 0;
    }
  }

  dt {
    font-size: 11px;
    color: #7a8c86;
  }

  dd {
    margin: 0;
    font-size: 14px;
    font-weight: 650;
    color: #245f53;
  }
}

.maintenance-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 16px;
  margin-top: 16px;
}

.maintenance-panel {
  min-width: 0;
  padding: 20px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 13px;
    border-bottom: 1px solid #e5ece9;
  }

  h2 {
    margin: 3px 0 0;
    font-size: 19px;
    font-weight: 650;
  }

  header > div > span {
    font-size: 11px;
    font-weight: 650;
    color: #4d7c70;
  }
}

.maintenance-panel__meta {
  padding: 5px 8px;
  font-size: 11px;
  color: #5d766f;
  background: #f4f8f6;
  border: 1px solid #dfe8e4;
}

.maintenance-panel__description {
  margin: 14px 0;
  font-size: 13px;
  line-height: 1.75;
  color: #687b75;
}

.diagnostic-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.diagnostic-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: start;
  padding: 12px;
  background: #f8fbfa;
  border: 1px solid #e1e9e6;

  strong {
    font-size: 13px;
  }

  p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.55;
    color: #73847f;
  }

  small {
    font-family: "Avenir Next", sans-serif;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: #82918c;
  }
}

.diagnostic-row__dot {
  width: 8px;
  height: 8px;
  margin-top: 4px;
  background: #b6c3bf;
  border-radius: 50%;
}

.diagnostic-row[data-status="pass"] .diagnostic-row__dot {
  background: #2f806a;
  box-shadow: 0 0 0 4px rgb(47 128 106 / 12%);
}

.diagnostic-row[data-status="fail"] {
  background: #fff8f7;
  border-color: #e6c2be;

  .diagnostic-row__dot {
    background: #b83b33;
    box-shadow: 0 0 0 4px rgb(184 59 51 / 12%);
  }
}

.data-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 14px;
  border-top: 1px solid #e4ece9;
  border-left: 1px solid #e4ece9;

  article {
    display: grid;
    gap: 4px;
    padding: 14px;
    border-right: 1px solid #e4ece9;
    border-bottom: 1px solid #e4ece9;
  }

  span,
  small {
    font-size: 11px;
    color: #7b8c87;
  }

  strong {
    font-family: "Avenir Next", sans-serif;
    font-size: 24px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    color: #245f53;
  }
}

.maintenance-notes {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
  margin-top: 12px;
  background: #f6faf8;
  border-left: 3px solid #75a899;

  strong {
    font-size: 12px;
  }

  p {
    margin: 4px 0 0;
    font-size: 11px;
    line-height: 1.55;
    color: #6f817b;
  }

  button {
    flex-shrink: 0;
    padding: 8px 10px;
    font-size: 11px;
    color: #256456;
    cursor: pointer;
    background: #fff;
    border: 1px solid #bfd5cd;
  }
}

.backup-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.backup-action {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  color: #173c3a;
  text-align: left;
  cursor: pointer;
  background: #f8fbfa;
  border: 1px solid #dce6e2;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;

  &:hover,
  &:focus-visible {
    outline: none;
    background: #edf7f2;
    border-color: #8eb8aa;
  }

  span {
    font-size: 11px;
    color: #688078;
  }

  strong {
    font-size: 14px;
  }

  small {
    font-size: 11px;
    line-height: 1.55;
    color: #7a8b86;
  }
}

.maintenance-checklist {
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 14px 0 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 11px;
    align-items: start;
    padding: 11px 0;
    border-bottom: 1px solid #e9efed;

    &:last-child {
      border-bottom: 0;
    }

    > span {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      font-family: "Avenir Next", sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #2f7765;
      background: #edf6f2;
      border: 1px solid #d0e3dc;
      border-radius: 50%;
    }

    strong {
      font-size: 13px;
    }

    p {
      margin: 4px 0 0;
      font-size: 12px;
      line-height: 1.6;
      color: #73847f;
    }
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

@media (width <= 1100px) {
  .maintenance-grid {
    grid-template-columns: 1fr;
  }
}

@media (width <= 760px) {
  .maintenance-header,
  .maintenance-notes {
    flex-direction: column;
    align-items: flex-start;
  }

  .maintenance-header__actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .maintenance-command {
    grid-template-columns: 1fr;
  }

  .maintenance-command dl,
  .backup-actions {
    grid-template-columns: 1fr;
  }

  .maintenance-command dl div {
    border-right: 0;
    border-bottom: 1px solid #e3ebe8;
  }

  .data-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
