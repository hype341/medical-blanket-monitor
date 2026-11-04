<template>
  <div class="developer-page">
    <header class="admin-page-header">
      <div>
        <span>{{ store.hospital.name }} · 开发者区域</span>
        <h1>开发者控制台</h1>
        <p>查看服务连接、原始 MQTT 报文、设备协议和系统接口状态。</p>
      </div>
      <span class="developer-badge">DEVELOPER</span>
    </header>

    <section class="service-strip">
      <article v-for="service in services" :key="service.name">
        <span />
        <div>
          <strong>{{ service.name }}</strong>
          <small>{{ service.state }}</small>
        </div>
      </article>
    </section>

    <div class="developer-grid">
      <section class="developer-card">
        <header>
          <h2>MQTT 原始报文</h2>
          <span>暂无数据</span>
        </header>
        <div class="message-empty">
          <code>SUB {{ store.mqttSettings.telemetryTopic }}</code>
          <div class="bed-topic-list">
            <code v-for="topic in bedTelemetryTopics" :key="topic">{{ topic }}</code>
          </div>
          <p>EMQX 尚未接入，原始消息到达后会在这里显示 Topic、QoS、到达时间和 JSON 报文。</p>
        </div>
      </section>

      <section class="developer-card">
        <header>
          <h2>接口与密钥</h2>
          <span>只读</span>
        </header>
        <dl>
          <div>
            <dt>前端 API</dt>
            <dd>/prod-api/api/v1</dd>
          </div>
          <div>
            <dt>视频代理</dt>
            <dd>/live</dd>
          </div>
          <div>
            <dt>MQTT 账户</dt>
            <dd>{{ store.mqttSettings.username }}</dd>
          </div>
          <div>
            <dt>公开 API Key</dt>
            <dd>未创建</dd>
          </div>
        </dl>
      </section>
    </div>

    <section class="developer-card developer-card--full">
      <header>
        <h2>设备协议适配</h2>
        <span>RTSP / RTMP / SRT → MediaMTX</span>
      </header>
      <div class="protocol-flow">
        <span>摄像头源</span>
        <strong>→</strong>
        <span>MediaMTX</span>
        <strong>→</strong>
        <span>WebRTC / HLS / FLV</span>
        <strong>→</strong>
        <span>护士工作台</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useMonitoringStore } from "../store";

const store = useMonitoringStore();
const services = [
  { name: "Nginx", state: "前端已上线" },
  { name: "Spring Boot", state: "未接入" },
  { name: "EMQX", state: "未接入" },
  { name: "MediaMTX", state: "未接入" },
];
const bedTelemetryTopics = computed(() =>
  store.bedSummaries
    .map((summary) => summary.telemetryTopic)
    .filter((topic): topic is string => Boolean(topic)),
);
</script>

<style scoped lang="scss">
.developer-page {
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

.developer-badge {
  padding: 5px 8px;
  font-family: "Avenir Next", sans-serif;
  color: #a43d34 !important;
  letter-spacing: 0.08em;
  background: #fff0ee;
  border: 1px solid #e4b2ac;
}

.service-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 18px;
  background: #fff;
  border: 1px solid #dbe6e2;

  article {
    display: flex;
    gap: 9px;
    align-items: center;
    padding: 14px;
    border-right: 1px solid #e5ece9;

    &:last-child {
      border-right: 0;
    }

    > span {
      width: 7px;
      height: 7px;
      background: #849590;
      border-radius: 50%;
    }

    div {
      display: grid;
      gap: 3px;
    }

    strong {
      font-size: 11px;
    }

    small {
      font-size: 9px;
      color: #7d8d88;
    }
  }
}

.developer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.developer-card {
  padding: 18px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 650;
    }

    span {
      font-size: 9px;
      color: #81918c;
    }
  }
}

.developer-card--full {
  margin-top: 14px;
}

.message-empty {
  display: grid;
  gap: 8px;
  padding: 12px;
  margin-top: 14px;
  background: #f5f9f7;
  border-left: 3px solid #4d8d7c;

  code {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    color: #316a5d;
    white-space: nowrap;
  }

  p {
    margin: 2px 0 0;
    font-size: 10px;
    line-height: 1.7;
    color: #7d8d88;
  }
}

.bed-topic-list {
  display: grid;
  gap: 4px;
  max-height: 150px;
  overflow: auto;
}

dl {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;

  div {
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr);
    gap: 10px;
    padding-bottom: 7px;
    border-bottom: 1px solid #edf1ef;
  }

  dt {
    font-size: 10px;
    color: #7e8e89;
  }

  dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    color: #315f55;
    white-space: nowrap;
  }
}

.protocol-flow {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px;
  margin-top: 14px;
  overflow-x: auto;
  font-size: 11px;
  color: #4f6e66;
  white-space: nowrap;
  background: #f4f9f7;
}

@media (width <= 800px) {
  .service-strip,
  .developer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 520px) {
  .service-strip,
  .developer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
