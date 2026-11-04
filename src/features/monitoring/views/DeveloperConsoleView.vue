<template>
  <div class="developer-page">
    <header class="admin-page-header">
      <div>
        <span>{{ store.hospital.name }} · 开发者区域</span>
        <h1>开发者工作台</h1>
        <p>技术能力集中为 MQTT 与视频两条管线，配置、状态和诊断入口互不混杂。</p>
      </div>
      <span class="developer-badge">DEVELOPER</span>
    </header>

    <section class="developer-hero">
      <div>
        <span class="developer-hero__eyebrow">SYSTEM CONTROL</span>
        <h2>两条数据管线，一个运行视图</h2>
        <p>MQTT 负责传感器事件，视频管线负责实时画面、录像与回放。当前所有连接和报文均可追踪。</p>
      </div>
      <div class="developer-hero__signal">
        <i />
        <div>
          <strong>开发环境在线</strong>
          <small>等待硬件数据接入</small>
        </div>
      </div>
    </section>

    <div class="pipeline-grid">
      <button
        class="pipeline-card pipeline-card--mqtt"
        type="button"
        @click="router.push('/admin/connections')"
      >
        <span class="pipeline-card__index">01</span>
        <div class="pipeline-card__title">
          <span>MQTT 中枢</span>
          <h2>传感器数据接入</h2>
        </div>
        <div class="pipeline-card__stats">
          <div>
            <small>Broker</small>
            <strong>{{ store.mqttSettings.brokerUrl }}</strong>
          </div>
          <div>
            <small>床位上送 Topic</small>
            <strong>{{ bedTelemetryTopics.length }} 个</strong>
          </div>
          <div>
            <small>QoS</small>
            <strong>{{ store.mqttSettings.qos }}</strong>
          </div>
        </div>
        <footer>
          <span>连接配置 · 账号密码 · Topic · 原始报文</span>
          <strong>进入 MQTT 管理</strong>
        </footer>
      </button>

      <button
        class="pipeline-card pipeline-card--video"
        type="button"
        @click="router.push('/devices/cameras')"
      >
        <span class="pipeline-card__index">02</span>
        <div class="pipeline-card__title">
          <span>视频管线</span>
          <h2>实时画面与录像</h2>
        </div>
        <div class="pipeline-card__stats">
          <div>
            <small>摄像头</small>
            <strong>{{ store.cameras.length }} 路</strong>
          </div>
          <div>
            <small>媒体服务</small>
            <strong>MediaMTX</strong>
          </div>
          <div>
            <small>录像策略</small>
            <strong>1m / 24h</strong>
          </div>
        </div>
        <footer>
          <span>设备档案 · 实时协议 · 录像 · 回放</span>
          <strong>进入视频管理</strong>
        </footer>
      </button>
    </div>

    <section class="service-board">
      <header>
        <div>
          <span>运行状态</span>
          <h2>服务链路</h2>
        </div>
        <small>最后检查：刚刚</small>
      </header>
      <div class="service-flow">
        <article v-for="(service, index) in services" :key="service.name">
          <span class="service-state" :data-online="service.online" />
          <div>
            <strong>{{ service.name }}</strong>
            <small>{{ service.state }}</small>
          </div>
          <i v-if="index < services.length - 1">→</i>
        </article>
      </div>
    </section>

    <section class="developer-card">
      <header>
        <h2>开发者快捷信息</h2>
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
          <dt>录放入口</dt>
          <dd>http://10.208.236.131:9996</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useMonitoringStore } from "../store";

const store = useMonitoringStore();
const router = useRouter();
const services = [
  { name: "Nginx", state: "静态站点在线", online: true },
  { name: "Spring Boot", state: "业务服务未接入", online: false },
  { name: "EMQX", state: "等待 MQTT 参数", online: false },
  { name: "MediaMTX", state: "实时流在线", online: true },
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

.developer-hero {
  position: relative;
  display: flex;
  gap: 32px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 28px;
  margin-top: 18px;
  overflow: hidden;
  color: #e9f5f1;
  background:
    linear-gradient(115deg, rgb(5 44 42 / 96%), rgb(11 77 70 / 92%)),
    repeating-linear-gradient(90deg, transparent 0 47px, rgb(255 255 255 / 7%) 47px 48px);
  border-left: 5px solid #77c3a9;

  h2 {
    margin: 8px 0;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: clamp(24px, 3vw, 38px);
    font-weight: 650;
    letter-spacing: -0.04em;
  }

  p {
    max-width: 680px;
    margin: 0;
    font-size: 12px;
    line-height: 1.8;
    color: #a9c6bd;
  }
}

.developer-hero__eyebrow {
  font-family: "Avenir Next", sans-serif;
  font-size: 9px;
  color: #91cdb9;
  letter-spacing: 0.18em;
}

.developer-hero__signal {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  align-items: center;
  padding-left: 24px;
  border-left: 1px solid rgb(185 225 213 / 22%);

  i {
    width: 9px;
    height: 9px;
    background: #67d6a8;
    border-radius: 50%;
    box-shadow: 0 0 0 6px rgb(103 214 168 / 13%);
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
    color: #91b4a9;
  }
}

.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.pipeline-card {
  position: relative;
  display: grid;
  gap: 18px;
  padding: 22px;
  color: #173c3a;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid #d5e3de;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: #76a99a;
    box-shadow: 0 16px 40px rgb(14 70 64 / 10%);
    transform: translateY(-2px);
  }

  &::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    content: "";
    background: #3f8977;
  }

  &--video::before {
    background: #45778b;
  }

  footer {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
    padding-top: 12px;
    font-size: 9px;
    color: #758983;
    border-top: 1px solid #e5ece9;

    strong {
      font-size: 10px;
      color: #28695b;
      white-space: nowrap;
    }
  }
}

.pipeline-card__index {
  font-family: "Avenir Next", sans-serif;
  font-size: 10px;
  color: #4a8577;
}

.pipeline-card__title {
  span {
    font-size: 10px;
    font-weight: 650;
    color: #628078;
  }

  h2 {
    margin: 5px 0 0;
    font-size: 21px;
    font-weight: 650;
    letter-spacing: -0.03em;
  }
}

.pipeline-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;

  div {
    display: grid;
    gap: 4px;
    min-width: 0;
    padding: 10px;
    background: #f5f9f7;
  }

  small {
    font-size: 8px;
    color: #81928d;
  }

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: 11px;
    color: #285d53;
    white-space: nowrap;
  }
}

.service-board {
  padding: 18px;
  margin-top: 14px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    span {
      font-size: 9px;
      color: #758a83;
    }

    h2 {
      margin: 3px 0 0;
      font-size: 14px;
    }

    small {
      font-size: 9px;
      color: #8b9894;
    }
  }
}

.service-flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;

  article {
    position: relative;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 11px;
    background: #f7faf9;
    border: 1px solid #e3ebe8;

    > div {
      display: grid;
      gap: 3px;
    }

    strong {
      font-size: 10px;
    }

    small {
      font-size: 8px;
      color: #82918d;
    }

    > i {
      position: absolute;
      right: -9px;
      z-index: 1;
      font-style: normal;
      color: #7a9a91;
    }
  }
}

.service-state {
  width: 7px;
  height: 7px;
  background: #9ba8a4;
  border-radius: 50%;

  &[data-online="true"] {
    background: #3ca57d;
    box-shadow: 0 0 0 4px rgb(60 165 125 / 12%);
  }
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
  .pipeline-grid {
    grid-template-columns: 1fr;
  }

  .service-flow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 520px) {
  .developer-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .developer-hero__signal {
    padding-left: 0;
    border-left: 0;
  }

  .service-flow {
    grid-template-columns: 1fr;
  }
}
</style>
