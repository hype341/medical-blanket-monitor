<template>
  <div class="connection-page">
    <header class="admin-page-header">
      <div>
        <span>{{ store.hospital.name }} · 开发者区域</span>
        <h1>系统连接与 MQTT</h1>
        <p>管理 Broker 接入、床位数据主题、床位告警主题和两类报文。</p>
      </div>
      <div class="admin-page-header__actions">
        <span class="connection-mode">开发环境配置</span>
        <el-button type="primary" @click="save">保存连接配置</el-button>
      </div>
    </header>

    <section class="connection-summary" aria-label="MQTT 配置概览">
      <article>
        <span>Broker</span>
        <strong>{{ form.brokerUrl }}</strong>
        <small>设备消息接入地址</small>
      </article>
      <article>
        <span>WebSocket</span>
        <strong>{{ form.websocketUrl }}</strong>
        <small>浏览器实时订阅</small>
      </article>
      <article>
        <span>主题通道</span>
        <strong>{{ dataTopicCount }} 数据 / {{ alarmTopicCount }} 告警</strong>
        <small>数据与告警均按床位独立</small>
      </article>
      <article>
        <span>服务质量</span>
        <strong>QoS {{ form.qos }}</strong>
        <small>当前订阅级别</small>
      </article>
    </section>

    <div class="connection-grid">
      <section class="connection-card">
        <header class="connection-card__header">
          <div>
            <span>连接属性</span>
            <h2>EMQX 接入</h2>
          </div>
          <small>凭证不会下发给摄像头</small>
        </header>
        <el-form label-position="top">
          <el-form-item label="MQTT Broker">
            <el-input v-model.trim="form.brokerUrl" placeholder="mqtt://host:1883" />
          </el-form-item>
          <el-form-item label="WebSocket">
            <el-input v-model.trim="form.websocketUrl" placeholder="ws://host:8083/mqtt" />
          </el-form-item>
          <el-form-item label="Client ID">
            <el-input v-model.trim="form.clientId" />
          </el-form-item>
          <div class="connection-row">
            <el-form-item label="用户名">
              <el-input v-model.trim="form.username" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                show-password
              />
            </el-form-item>
          </div>
          <el-button text @click="showPassword = !showPassword">
            {{ showPassword ? "隐藏密码" : "显示密码" }}
          </el-button>
          <el-form-item label="QoS">
            <el-radio-group v-model="form.qos">
              <el-radio-button :value="0">0</el-radio-button>
              <el-radio-button :value="1">1</el-radio-button>
              <el-radio-button :value="2">2</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </section>

      <section class="connection-card connection-card--alerts">
        <header class="connection-card__header">
          <div>
            <span>MQTT 主题</span>
            <h2>床位数据与告警</h2>
          </div>
          <small>每张床位分别拥有数据主题和告警主题</small>
        </header>
        <div class="topic-switch" role="tablist" aria-label="MQTT 主题类型">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTopicMode === 'data'"
            :class="{ 'is-active': activeTopicMode === 'data' }"
            @click="activeTopicMode = 'data'"
          >
            <span>床位数据</span>
            <strong>{{ dataTopicCount }}</strong>
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTopicMode === 'alarm'"
            :class="{ 'is-active': activeTopicMode === 'alarm' }"
            @click="activeTopicMode = 'alarm'"
          >
            <span>床位告警</span>
            <strong>{{ alarmTopicCount }}</strong>
          </button>
        </div>

        <div v-if="activeTopicMode === 'data'" class="topic-mode-panel">
          <div class="alarm-subscription">
            <div>
              <span>传感器数据订阅</span>
              <strong>{{ dataTopicCount }} 张已绑定床位</strong>
            </div>
            <code>{{ SENSOR_DATA_TOPIC }}</code>
            <small>传感器状态、时间和识别扩展数据进入此数据通道。</small>
          </div>
          <div class="room-topic-panel topic-panel--data">
            <header>
              <div>
                <span>床位独立数据通道</span>
                <strong>{{ dataTopicCount }} 个数据主题</strong>
              </div>
              <small>{{ bedTopicRows.length - dataTopicCount }} 张床位待绑定传感器</small>
            </header>
            <div class="room-topic-cards">
              <article v-for="row in bedTopicRows" :key="row.bedId">
                <div>
                  <strong>{{ row.roomName }} · {{ row.bedNo }} 床</strong>
                  <span>{{ row.wardName }} · {{ row.sensorName }}</span>
                </div>
                <code :title="row.dataTopic || '绑定传感器后生成'">
                  {{ row.dataTopic || "绑定传感器后生成" }}
                </code>
                <el-button
                  text
                  type="primary"
                  :disabled="!row.dataTopic"
                  @click="row.dataTopic && copyTopic(row.dataTopic, '床位数据主题')"
                >
                  复制
                </el-button>
              </article>
            </div>
          </div>
        </div>

        <div v-else class="topic-mode-panel">
          <div class="alarm-subscription alarm-subscription--warning">
            <div>
              <span>床位告警订阅</span>
              <strong>{{ alarmTopicCount }} 张床位</strong>
            </div>
            <code>{{ form.alarmTopic }}</code>
            <small>每张床位独立上报告警，报文中的 bedId 用于二次校验。</small>
          </div>
          <div class="room-topic-panel topic-panel--alarm">
            <header>
              <div>
                <span>床位独立告警通道</span>
                <strong>{{ alarmTopicCount }} 个床位告警主题</strong>
              </div>
              <small>按床位 · 逐项复制</small>
            </header>
            <div class="room-topic-cards">
              <article v-for="row in bedTopicRows" :key="row.bedId">
                <div>
                  <strong>{{ row.roomName }} · {{ row.bedNo }} 床</strong>
                  <span>{{ row.wardName }}</span>
                </div>
                <code :title="row.alarmTopic || '未生成'">
                  {{ row.alarmTopic || "未生成" }}
                </code>
                <el-button
                  text
                  type="primary"
                  :disabled="!row.alarmTopic"
                  @click="row.alarmTopic && copyTopic(row.alarmTopic, '床位告警主题')"
                >
                  复制
                </el-button>
              </article>
            </div>
          </div>
          <details class="alarm-template-settings">
            <summary>告警展示文案</summary>
            <el-form label-position="top">
              <el-form-item label="告警标题模板">
                <el-input v-model="form.alarmTitleTemplate" />
              </el-form-item>
              <el-form-item label="告警详情模板">
                <el-input v-model="form.alarmDetailTemplate" type="textarea" :rows="3" />
              </el-form-item>
            </el-form>
          </details>
        </div>
      </section>
    </div>

    <section class="message-grid">
      <article class="message-card message-card--data">
        <header>
          <span>传感器数据</span>
          <h2>传感器数据报文</h2>
          <p>只上报设备、时间、状态和扩展容器，图形由状态字段驱动。</p>
        </header>
        <pre>{{ sensorDataTemplate }}</pre>
        <footer>
          <code>status</code>
          <span>ONLINE / STALE / OFFLINE / ALARM</span>
        </footer>
      </article>
      <article class="message-card message-card--alarm">
        <header>
          <span>床位告警</span>
          <h2>床位告警报文</h2>
          <p>主题直接归属床位，报文只保留护士需要处理的信息。</p>
        </header>
        <pre>{{ alarmTemplate }}</pre>
        <footer>
          <code>bedId</code>
          <span>定位到具体床位并关联摄像头</span>
        </footer>
      </article>
    </section>

    <section class="connection-note">
      <strong>凭证与接入边界</strong>
      <p>
        正式环境由 Spring Boot 加密保存 Broker
        凭证。浏览器只获取短期订阅能力，摄像头源地址和密码不会进入前端配置。
      </p>
    </section>

    <section class="raw-message-panel">
      <header>
        <div>
          <span>实时诊断</span>
          <h2>MQTT 原始报文</h2>
          <p>连接成功后在这里查看订阅主题、到达时间和原始 JSON。</p>
        </div>
        <span class="diagnostic-state">
          <i />
          等待 Broker 连接
        </span>
      </header>
      <div class="raw-topic-list raw-topic-list--diagnostics">
        <code>SUB {{ SENSOR_DATA_TOPIC }}</code>
        <code>SUB {{ form.alarmTopic }}</code>
      </div>
    </section>

    <section class="document-panel">
      <header>
        <div>
          <span>在线生成</span>
          <h2>MQTT 连接文档</h2>
          <p>根据当前病区、床位、传感器和 MQTT 配置实时生成。</p>
        </div>
        <div class="document-panel__actions">
          <el-button @click="regenerateMqttDocument">重新生成</el-button>
          <el-button @click="copyMqttDocument">复制文档</el-button>
          <el-button @click="downloadMqttDocument">下载 Markdown</el-button>
          <el-button type="primary" @click="exportMqttPdf">导出 PDF</el-button>
        </div>
      </header>
      <DocumentPreview :content="mqttDocument" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import DocumentPreview from "../components/DocumentPreview.vue";
import { generateMqttDocumentation } from "../documentation";
import { useMonitoringStore } from "../store";
import type { MqttSettings } from "../types";
import { copyText } from "@/utils/clipboard";
import { SENSOR_DATA_TOPIC } from "../messaging";
import { printMarkdownDocument } from "@/utils/document-export";

const store = useMonitoringStore();
const form = reactive<MqttSettings>({ ...store.mqttSettings });
const showPassword = ref(false);
const activeTopicMode = ref<"data" | "alarm">("data");
const generatedAt = ref(new Date().toLocaleString("zh-CN", { hour12: false }));
const mqttDocument = computed(() =>
  generateMqttDocumentation(
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
    form,
    generatedAt.value,
  ),
);
const alarmTemplate = JSON.stringify(
  {
    alarmId: "alarm-01",
    level: "WARNING",
    title: "传感器状态异常",
    bedId: "bed-a-01",
    occurredAt: "2026-11-04T17:04:20+08:00",
  },
  null,
  2,
);
const sensorDataTemplate = JSON.stringify(
  {
    messageId: "message-01",
    deviceKey: "blanket-001",
    bedId: "bed-a-01",
    observedAt: "2026-11-04T17:04:20+08:00",
    status: "ONLINE",
    metrics: {},
  },
  null,
  2,
);
const bedTopicRows = computed(() =>
  store.bedSummaries.map((summary) => ({
    bedId: summary.bed.id,
    dataTopic: summary.dataTopic,
    alarmTopic: summary.alarmTopic,
    wardName: summary.ward?.name ?? "未分病区",
    roomName: summary.room?.name ?? "未分病房",
    bedNo: summary.bed.bedNo,
    sensorName: summary.sensor?.name ?? "未绑定传感器",
  })),
);
const dataTopicCount = computed(
  () => bedTopicRows.value.filter((row) => Boolean(row.dataTopic)).length,
);
const alarmTopicCount = computed(
  () => bedTopicRows.value.filter((row) => Boolean(row.alarmTopic)).length,
);

function save(): void {
  try {
    store.updateMqttSettings(form);
    Object.assign(form, store.mqttSettings);
    ElMessage.success("MQTT 配置已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "MQTT 配置保存失败");
  }
}

async function copyTopic(topic: string, label = "主题"): Promise<void> {
  try {
    await copyText(topic);
    ElMessage.success(`${label}已复制`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "主题复制失败");
  }
}

function regenerateMqttDocument(): void {
  generatedAt.value = new Date().toLocaleString("zh-CN", { hour12: false });
}

async function copyMqttDocument(): Promise<void> {
  try {
    await copyText(mqttDocument.value);
    ElMessage.success("MQTT 文档已复制");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "MQTT 文档复制失败");
  }
}

function downloadMqttDocument(): void {
  downloadText("mqtt-connection.md", mqttDocument.value);
}

function exportMqttPdf(): void {
  try {
    printMarkdownDocument("智能毯平台 MQTT 连接文档", mqttDocument.value);
    ElMessage.info("请在打印窗口中选择“另存为 PDF”");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "PDF 导出失败");
  }
}

function downloadText(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped lang="scss">
.connection-page {
  color: #173c3a;
}

.admin-page-header {
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

.admin-page-header__actions {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  align-items: center;
}

.connection-mode {
  padding: 5px 8px;
  font-size: 9px !important;
  font-weight: 650;
  color: #2d6d5e !important;
  background: #edf7f2;
  border: 1px solid #c4ddd5;
}

.connection-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 16px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #dbe6e2;

  article {
    display: grid;
    gap: 5px;
    min-width: 0;
    padding: 14px 16px;
    border-right: 1px solid #e4ece9;

    &:last-child {
      border-right: 0;
    }
  }

  span,
  small {
    font-size: 9px;
    color: #7d8e89;
  }

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: 12px;
    font-weight: 650;
    color: #275f53;
    white-space: nowrap;
  }
}

.connection-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.06fr) minmax(340px, 0.94fr);
  gap: 14px;
  margin-top: 14px;
}

.connection-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #dbe6e2;

  &--alerts {
    background: linear-gradient(180deg, rgb(240 248 245 / 72%), transparent 120px), #fff;
  }
}

.connection-card__header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 14px;
  margin-bottom: 15px;
  border-bottom: 1px solid #e5ece9;

  span {
    font-size: 9px;
    font-weight: 700;
    color: #4f766c;
    letter-spacing: 0.08em;
  }

  h2 {
    margin: 4px 0 0;
    font-size: 17px;
    font-weight: 680;
    letter-spacing: -0.02em;
  }

  small {
    max-width: 170px;
    font-size: 9px;
    line-height: 1.55;
    color: #85948f;
    text-align: right;
  }
}

.connection-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.topic-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  margin-bottom: 12px;
  background: #edf3f0;

  button {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    color: #607770;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;

    span {
      font-size: 10px;
      font-weight: 650;
    }

    strong {
      display: grid;
      place-items: center;
      min-width: 22px;
      height: 22px;
      font-family: "Avenir Next", sans-serif;
      font-size: 9px;
      color: #4f756b;
      background: #fff;
      border-radius: 11px;
    }

    &.is-active {
      color: #245d51;
      background: #fff;
      border-color: #b8d1c8;
      box-shadow: 0 2px 8px rgb(26 91 77 / 8%);

      strong {
        color: #fff;
        background: #2f806a;
      }
    }

    &:focus-visible {
      outline: 2px solid #2f806a;
      outline-offset: 1px;
    }
  }
}

.topic-mode-panel {
  min-width: 0;
}

.alarm-subscription {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 12px;
  padding: 12px;
  background: #edf7f2;
  border-left: 3px solid #2f806a;

  div {
    display: grid;
    gap: 3px;
  }

  span,
  small {
    font-size: 9px;
    color: #72877f;
  }

  strong {
    font-size: 11px;
    color: #2e6558;
  }

  code {
    align-self: center;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    color: #2d6b5d;
    white-space: nowrap;
  }

  small {
    grid-column: 1 / -1;
    line-height: 1.55;
  }

  &--warning {
    background: #fff6f3;
    border-left-color: #c3594b;
  }
}

.room-topic-panel {
  padding: 12px;
  margin-top: 12px;
  background: #f7fbf9;
  border: 1px solid #e0eae6;

  > header {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;

    div {
      display: grid;
      gap: 3px;
    }

    span,
    small {
      font-size: 9px;
      color: #81918c;
    }

    strong {
      font-size: 11px;
      color: #35675c;
    }
  }

  &--data {
    border-left: 3px solid #438b78;
  }

  &--alarm {
    border-left: 3px solid #c3594b;
  }
}

.room-topic-cards {
  display: grid;
  gap: 6px;
  margin-top: 10px;

  article {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 9px 10px;
    background: #fff;
    border: 1px solid #e3ebe8;

    > div {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    strong {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 10px;
      color: #315f55;
      white-space: nowrap;
    }

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 8px;
      color: #81918c;
      white-space: nowrap;
    }

    code {
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 9px;
      color: #2f6b5e;
      white-space: nowrap;
    }
  }
}

.topic-panel--data .room-topic-cards {
  max-height: 270px;
  padding-right: 3px;
  overflow: auto;
}

.topic-panel--alarm .room-topic-cards {
  max-height: 270px;
  padding-right: 3px;
  overflow: auto;
}

.alarm-template-settings {
  margin-top: 10px;
  background: #fbfcfb;
  border: 1px solid #e4ece9;

  summary {
    padding: 10px 12px;
    font-size: 9px;
    font-weight: 650;
    color: #5d746d;
    cursor: pointer;
  }

  .el-form {
    padding: 0 12px 12px;
  }
}

.message-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.message-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    padding: 16px 17px 13px;
    border-bottom: 1px solid #e5ece9;

    span {
      font-size: 8px;
      font-weight: 700;
      color: #4b8576;
      letter-spacing: 0.12em;
    }

    h2 {
      margin: 4px 0 5px;
      font-size: 16px;
      font-weight: 680;
    }

    p {
      margin: 0;
      font-size: 10px;
      line-height: 1.6;
      color: #7d8d88;
    }
  }

  pre {
    max-height: 270px;
    padding: 14px 17px;
    margin: 0;
    overflow: auto;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    line-height: 1.65;
    color: #d8ebe5;
    background: #082f2b;
  }

  footer {
    display: flex;
    gap: 9px;
    align-items: center;
    padding: 10px 17px;
    background: #f7faf9;
    border-top: 1px solid #e5ece9;

    code {
      padding: 2px 5px;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 9px;
      color: #2d6b5d;
      background: #e9f4ef;
    }

    span {
      font-size: 9px;
      color: #738681;
    }
  }

  &--alarm pre {
    background: #2c2422;
  }
}

.connection-note {
  padding: 14px;
  margin-top: 14px;
  background: #fff4f2;
  border-left: 3px solid #c84a3f;

  strong {
    font-size: 11px;
    color: #9c3e35;
  }

  p {
    margin: 5px 0 0;
    font-size: 10px;
    line-height: 1.7;
    color: #78625e;
  }
}

.raw-message-panel {
  padding: 18px;
  margin-top: 14px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;

    span {
      font-size: 9px;
      color: #81918c;
    }

    h2 {
      margin: 3px 0 0;
      font-size: 15px;
    }

    p {
      margin: 4px 0 0;
      font-size: 9px;
      color: #7e8e89;
    }
  }
}

.diagnostic-state {
  display: inline-flex;
  flex-shrink: 0;
  gap: 7px;
  align-items: center;
  padding: 5px 8px;
  color: #7d6b49 !important;
  background: #fbf7ed;
  border: 1px solid #e4d5b8;

  i {
    width: 6px;
    height: 6px;
    background: #bc8b3d;
    border-radius: 50%;
  }
}

.raw-topic-list {
  display: grid;
  gap: 5px;
  max-height: 180px;
  padding: 10px;
  margin-top: 12px;
  overflow: auto;
  background: #f5f9f7;
  border-left: 3px solid #4c8c7b;

  code {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    color: #315f55;
    white-space: nowrap;
  }
}

.raw-topic-list--diagnostics {
  max-height: 120px;
  background:
    repeating-linear-gradient(90deg, transparent 0 47px, rgb(23 60 58 / 3%) 47px 48px), #f5f9f7;
}

.document-panel {
  padding: 18px;
  margin-top: 14px;
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

.document-panel__actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}

@media (width <= 800px) {
  .admin-page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-page-header__actions {
    justify-content: space-between;
    width: 100%;
  }

  .connection-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    article:nth-child(2) {
      border-right: 0;
    }

    article:nth-child(-n + 2) {
      border-bottom: 1px solid #e4ece9;
    }
  }

  .connection-grid {
    grid-template-columns: 1fr;
  }

  .message-grid {
    grid-template-columns: 1fr;
  }

  .document-panel > header {
    flex-direction: column;
  }

  .document-panel__actions {
    flex-wrap: wrap;
  }
}

@media (width <= 520px) {
  .connection-card__header {
    flex-direction: column;

    small {
      max-width: none;
      text-align: left;
    }
  }

  .connection-row {
    grid-template-columns: 1fr;
  }

  .alarm-subscription {
    grid-template-columns: 1fr;

    small {
      grid-column: auto;
    }
  }

  .room-topic-cards article {
    grid-template-columns: 1fr auto;

    code {
      grid-column: 1 / -1;
      overflow-wrap: anywhere;
      white-space: normal;
    }
  }

  .connection-summary {
    grid-template-columns: 1fr;

    article {
      border-right: 0;
      border-bottom: 1px solid #e4ece9;

      &:last-child {
        border-bottom: 0;
      }
    }
  }
}
</style>
