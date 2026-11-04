<template>
  <div class="connection-page">
    <header class="admin-page-header">
      <div>
        <span>{{ store.hospital.name }} · 开发者区域</span>
        <h1>系统连接与 MQTT</h1>
        <p>管理 Broker 账户、Topic、QoS 和消息模板。该页面仅开发者可见。</p>
      </div>
      <el-button type="primary" @click="save">保存连接配置</el-button>
    </header>

    <div class="connection-grid">
      <section class="connection-card">
        <span>连接属性</span>
        <h2>EMQX 接入</h2>
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

      <section class="connection-card">
        <span>Topic</span>
        <h2>遥测与告警</h2>
        <el-form label-position="top">
          <el-form-item label="遥测主题">
            <el-input v-model.trim="form.telemetryTopic" />
          </el-form-item>
          <el-form-item label="告警主题">
            <el-input v-model.trim="form.alarmTopic" />
          </el-form-item>
          <el-form-item label="告警标题模板">
            <el-input v-model="form.alarmTitleTemplate" />
          </el-form-item>
          <el-form-item label="告警详情模板">
            <el-input v-model="form.alarmDetailTemplate" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>

        <div class="message-template">
          <span>告警报文模板</span>
          <pre>{{ alarmTemplate }}</pre>
        </div>
      </section>
    </div>

    <section class="connection-note">
      <strong>凭证安全</strong>
      <p>
        当前为前端配置演示值。正式环境由 Spring Boot
        加密保存，浏览器通过鉴权接口读取，不下发摄像头源凭证。
      </p>
    </section>

    <section class="raw-message-panel">
      <header>
        <div>
          <span>订阅诊断</span>
          <h2>MQTT 原始报文</h2>
        </div>
        <small>等待 Broker 连接</small>
      </header>
      <div class="raw-topic-list">
        <code v-for="topic in bedTelemetryTopics" :key="topic">SUB {{ topic }}</code>
      </div>
      <p>连接成功后，这里查看 Topic、QoS、到达时间和原始 JSON。</p>
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
          <el-button type="primary" @click="downloadMqttDocument">下载 Markdown</el-button>
        </div>
      </header>
      <pre>{{ mqttDocument }}</pre>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { generateMqttDocumentation } from "../documentation";
import { useMonitoringStore } from "../store";
import type { MqttSettings } from "../types";

const store = useMonitoringStore();
const form = reactive<MqttSettings>({ ...store.mqttSettings });
const showPassword = ref(false);
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
    code: "SENSOR_STATE_CHANGED",
    level: "WARNING",
    status: "OPEN",
    title: "传感器状态异常",
    detail: "设备上报状态变化",
    sensorKey: "blanket-001",
    cameraKey: "camera-01",
    bedId: "bed-a-01",
    occurredAt: "2026-11-04T17:04:20+08:00",
  },
  null,
  2,
);
const bedTelemetryTopics = computed(() =>
  store.bedSummaries
    .map((summary) => summary.telemetryTopic)
    .filter((topic): topic is string => Boolean(topic)),
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

function regenerateMqttDocument(): void {
  generatedAt.value = new Date().toLocaleString("zh-CN", { hour12: false });
}

async function copyMqttDocument(): Promise<void> {
  await navigator.clipboard.writeText(mqttDocument.value);
  ElMessage.success("MQTT 文档已复制");
}

function downloadMqttDocument(): void {
  downloadText("mqtt-connection.md", mqttDocument.value);
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

.connection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.connection-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > span {
    font-size: 10px;
    font-weight: 650;
    color: #4f766c;
  }

  h2 {
    margin: 6px 0 16px;
    font-size: 17px;
    font-weight: 650;
  }
}

.connection-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.message-template {
  padding: 12px;
  margin-top: 12px;
  background: #f4f8f6;
  border-left: 3px solid #2f806a;

  span {
    font-size: 10px;
    font-weight: 650;
    color: #4e756a;
  }

  pre {
    max-height: 280px;
    padding: 10px;
    margin: 8px 0 0;
    overflow: auto;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    line-height: 1.65;
    color: #355c52;
    background: #fff;
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
    align-items: center;
    justify-content: space-between;

    span,
    small {
      font-size: 9px;
      color: #81918c;
    }

    h2 {
      margin: 3px 0 0;
      font-size: 15px;
    }
  }

  > p {
    margin: 10px 0 0;
    font-size: 10px;
    color: #7e8e89;
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

  .connection-grid {
    grid-template-columns: 1fr;
  }

  .document-panel > header {
    flex-direction: column;
  }

  .document-panel__actions {
    flex-wrap: wrap;
  }
}
</style>
