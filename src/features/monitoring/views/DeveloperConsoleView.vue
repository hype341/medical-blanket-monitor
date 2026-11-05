<template>
  <div class="developer-page">
    <header class="admin-page-header">
      <div>
        <span>{{ store.hospital.name }} · 开发者区域</span>
        <h1>开发者工作台</h1>
        <p>技术能力集中为 MQTT 与视频两条管线，配置、状态和诊断入口互不混杂。</p>
      </div>
      <span class="developer-badge">开发者视图</span>
    </header>

    <section class="hospital-settings">
      <header>
        <span>机构基础信息</span>
        <h2>医院名称</h2>
        <p>医院名称尚未最终确定时可以先留空；保存后将同步到全局页面。</p>
      </header>
      <form @submit.prevent="saveHospitalName">
        <el-input
          v-model.trim="hospitalName"
          maxlength="40"
          clearable
          placeholder="请输入医院名称"
          aria-label="医院名称"
        />
        <el-button type="primary" native-type="submit" :disabled="!hospitalName">
          保存医院名称
        </el-button>
      </form>
    </section>

    <section class="hospital-settings platform-settings">
      <header>
        <span>平台标识</span>
        <h2>平台名称</h2>
        <p>用于侧栏品牌、登录页和浏览器标题，修改后立即同步到整个平台。</p>
      </header>
      <form @submit.prevent="savePlatformName">
        <el-input
          v-model.trim="platformName"
          maxlength="40"
          clearable
          placeholder="请输入平台名称"
          aria-label="平台名称"
        />
        <el-button type="primary" native-type="submit" :disabled="!platformName">
          保存平台名称
        </el-button>
      </form>
    </section>

    <section class="alarm-test-panel">
      <div>
        <span>警告通知</span>
        <h2>选择床位并下发 MQTT 通知</h2>
        <p>设备订阅对应床位告警主题后即可收到通知；页面预览用于验证本系统的标红和提醒。</p>
      </div>
      <div class="alarm-dispatch">
        <el-select v-model="alarmBedId" aria-label="告警床位" placeholder="选择床位">
          <el-option
            v-for="bed in alarmBedOptions"
            :key="bed.id"
            :label="bed.label"
            :value="bed.id"
          />
        </el-select>
        <el-select v-model="alarmLevel" aria-label="警告级别">
          <el-option label="提示" value="INFO" />
          <el-option label="警告" value="WARNING" />
          <el-option label="严重" value="CRITICAL" />
        </el-select>
        <el-input
          v-model.trim="alarmMessage"
          aria-label="警告内容"
          maxlength="80"
          placeholder="通知设备的内容"
        />
        <div class="alarm-dispatch__actions">
          <el-button type="danger" :loading="sendingAlarm" @click="sendMqttAlarm">
            下发警告
          </el-button>
          <el-button plain @click="sendTestAlarm">发送测试告警并查看</el-button>
        </div>
      </div>
    </section>

    <section class="developer-hero">
      <div>
        <span class="developer-hero__eyebrow">运行概览</span>
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

    <section class="developer-live" aria-label="实时运行数据">
      <header>
        <span>实时运行数据</span>
        <small>当前授权范围</small>
      </header>
      <div>
        <article>
          <strong>{{ store.visibleBeds.length }}</strong>
          <span>床位</span>
        </article>
        <article>
          <strong>{{ store.sensors.length }}</strong>
          <span>毯子</span>
        </article>
        <article>
          <strong>{{ store.cameras.length }}</strong>
          <span>摄像头</span>
        </article>
        <article :data-alert="store.openAlarmCount > 0">
          <strong>{{ store.openAlarmCount }}</strong>
          <span>待处理告警</span>
        </article>
      </div>
    </section>

    <section class="developer-shortcuts" aria-label="开发者快捷入口">
      <button type="button" @click="router.push('/devices/blankets')">
        <span>设备目录</span>
        <strong>毯子目录</strong>
        <small>名称、床位对应关系和 MQTT 同步</small>
      </button>
      <button type="button" @click="router.push('/devices/bindings')">
        <span>设备关系</span>
        <strong>设备绑定</strong>
        <small>毯子与摄像头归属床位</small>
      </button>
      <button type="button" @click="router.push('/devices/cameras')">
        <span>视频管线</span>
        <strong>摄像头链接</strong>
        <small>WebRTC、HLS、RTSP 和回放入口</small>
      </button>
      <button type="button" @click="router.push('/admin/connections')">
        <span>数据管线</span>
        <strong>MQTT 接入</strong>
        <small>主题、报文、文档和在线诊断</small>
      </button>
    </section>

    <div class="pipeline-grid">
      <button
        class="pipeline-card pipeline-card--mqtt"
        type="button"
        @click="router.push('/admin/connections')"
      >
        <span class="pipeline-card__index">MQTT</span>
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
            <small>MQTT 主题</small>
            <strong>{{ dataTopicCount }} 数据 / {{ bedAlarmTopics.length }} 告警</strong>
          </div>
          <div>
            <small>QoS</small>
            <strong>{{ store.mqttSettings.qos }}</strong>
          </div>
        </div>
        <footer>
          <span>连接配置 · 告警 Topic · 数据报文 · 原始报文</span>
          <strong>进入 MQTT 管理</strong>
        </footer>
      </button>

      <button
        class="pipeline-card pipeline-card--video"
        type="button"
        @click="router.push('/devices/cameras')"
      >
        <span class="pipeline-card__index">VIDEO</span>
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
          <dd>/api/public/sensors/{bedId}</dd>
        </div>
        <div>
          <dt>服务器时间</dt>
          <dd>/api/public/time</dd>
        </div>
        <div>
          <dt>告警通知</dt>
          <dd>MQTT · notification</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { useMonitoringStore } from "../store";
import {
  publishAlarmNotification,
  type NotificationLevel,
} from "../notifications";
import { navigateToBedDetail } from "../navigation";

const store = useMonitoringStore();
const router = useRouter();
const hospitalName = ref(store.hospital.name === "医院名称未设置" ? "" : store.hospital.name);
const platformName = ref(store.platformName);
const alarmBedId = ref(store.bedSummaries[0]?.bed.id ?? "");
const alarmLevel = ref<NotificationLevel>("WARNING");
const alarmMessage = ref("请检查当前床位毯子状态");
const sendingAlarm = ref(false);
const services = computed(() => [
  { name: "Nginx", state: "静态站点在线", online: true },
  { name: "EMQX", state: store.mqttSettings.brokerUrl, online: true },
  { name: "MQTT 告警监听", state: "WebSocket 实时订阅", online: true },
  {
    name: "MediaMTX",
    state: store.cameras.some((camera) => camera.status === "ONLINE")
      ? "实时流在线"
      : "等待视频设备",
    online: store.cameras.some((camera) => camera.status === "ONLINE"),
  },
]);
const bedAlarmTopics = computed(() =>
  Array.from(
    new Set(
      store.bedSummaries
        .map((summary) => summary.alarmTopic)
        .filter((topic): topic is string => Boolean(topic)),
    ),
  ),
);
const dataTopicCount = computed(
  () => store.bedSummaries.filter((summary) => Boolean(summary.dataTopic)).length,
);
const alarmBedOptions = computed(() =>
  store.bedSummaries.map((summary) => ({
    id: summary.bed.id,
    label: `${summary.ward?.name ?? "未分病区"} / ${summary.room?.name ?? "未分病房"} / ${
      summary.bed.bedNo
    } 床`,
  })),
);

function saveHospitalName(): void {
  try {
    store.updateHospitalName(hospitalName.value);
    hospitalName.value = store.hospital.name;
    ElMessage.success("医院名称已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "医院名称保存失败");
  }
}

function savePlatformName(): void {
  try {
    store.updatePlatformName(platformName.value);
    platformName.value = store.platformName;
    ElMessage.success("平台名称已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "平台名称保存失败");
  }
}

async function sendTestAlarm(): Promise<void> {
  const bed = store.beds.find((item) => item.id === "bed-a-01");
  if (!bed) {
    ElMessage.error("未找到测试床位");
    return;
  }
  const alarmId = `developer-test-${Date.now()}`;
  const occurredAt = new Date().toISOString();
  const summary = store.bedSummaries.find((item) => item.bed.id === bed.id);
  if (import.meta.env.VITE_MOCK_ENABLED === "true") {
    store.ingestAlarm({
      alarmId,
      code: "DEVELOPER_TEST_ALARM",
      level: "WARNING",
      status: "OPEN",
      title: "毯子状态异常",
      detail: "开发者工作台触发的联调告警",
      sensorKey: "blanket-001",
      cameraKey: "camera-01",
      wardId: bed.wardId,
      roomId: bed.roomId,
      bedId: bed.id,
      occurredAt,
    });
  } else {
    if (!summary?.alarmTopic) {
      ElMessage.error("当前床位没有告警主题");
      return;
    }
    try {
      await publishAlarmNotification(summary.alarmTopic, {
        alarmId,
        bedId: bed.id,
        level: "WARNING",
        message: "毯子状态异常",
        occurredAt,
      });
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : "测试告警下发失败");
      return;
    }
  }
  await navigateToBedDetail(router, bed.id);
}

async function sendMqttAlarm(): Promise<void> {
  const summary = store.bedSummaries.find((item) => item.bed.id === alarmBedId.value);
  if (!summary?.alarmTopic) {
    ElMessage.error("当前床位没有告警主题");
    return;
  }
  if (!alarmMessage.value.trim()) {
    ElMessage.error("请填写警告内容");
    return;
  }

  sendingAlarm.value = true;
  try {
    await publishAlarmNotification(summary.alarmTopic, {
      alarmId: `developer-notify-${Date.now()}`,
      bedId: summary.bed.id,
      level: alarmLevel.value,
      message: alarmMessage.value,
      occurredAt: new Date().toISOString(),
    });
    ElMessage.success(`警告已通过 MQTT 下发到 ${summary.bed.bedNo} 床`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "MQTT 通知下发失败");
  } finally {
    sendingAlarm.value = false;
  }
}
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

.hospital-settings {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(360px, 1.2fr);
  gap: 24px;
  align-items: center;
  padding: 16px 18px;
  margin-top: 16px;
  background: #fff;
  border: 1px solid #dbe6e2;
  border-left: 4px solid #4a927e;

  header {
    span {
      font-size: 9px;
      font-weight: 700;
      color: #4b8576;
      letter-spacing: 0.1em;
    }

    h2 {
      margin: 4px 0;
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

  form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }
}

.platform-settings {
  border-left-color: #47788b;
}

.alarm-test-panel {
  display: grid;
  grid-template-columns: minmax(260px, 0.85fr) minmax(420px, 1.15fr);
  gap: 20px;
  align-items: center;
  padding: 14px 18px;
  margin-top: 10px;
  background: #fff7f4;
  border: 1px solid #edd6d0;
  border-left: 4px solid #c3594b;

  > div {
    display: grid;
    gap: 3px;
  }

  span {
    font-size: 9px;
    font-weight: 700;
    color: #a34a40;
    letter-spacing: 0.1em;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 680;
  }

  p {
    margin: 0;
    font-size: 10px;
    color: #806f6b;
  }
}

.alarm-dispatch {
  display: grid;
  grid-template-columns: 180px 110px minmax(180px, 1fr);
  gap: 8px;
  align-items: center;

  &__actions {
    display: flex;
    grid-column: 1 / -1;
    gap: 8px;
    justify-content: flex-end;
  }
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

.developer-live {
  padding: 14px 16px;
  margin-top: 14px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid #e6ece9;

    span {
      font-size: 11px;
      font-weight: 680;
      color: #2d665a;
    }

    small {
      font-size: 9px;
      color: #81918c;
    }
  }

  > div {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-top: 11px;
  }

  article {
    display: flex;
    gap: 7px;
    align-items: baseline;
    padding: 4px 14px;
    border-right: 1px solid #e7eeeb;

    &:last-child {
      border-right: 0;
    }

    strong {
      font-family: "Avenir Next", "Noto Sans SC", sans-serif;
      font-size: 25px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: #28695b;
    }

    span {
      font-size: 9px;
      color: #7e8f89;
    }

    &[data-alert="true"] strong {
      color: #b83e34;
    }
  }
}

.developer-shortcuts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin-top: 14px;
  overflow: hidden;
  background: #dbe6e2;
  border: 1px solid #dbe6e2;

  button {
    display: grid;
    gap: 4px;
    padding: 14px;
    color: #315f55;
    text-align: left;
    cursor: pointer;
    background: #fff;
    border: 0;
    transition:
      color 160ms ease,
      background 160ms ease;

    &:hover,
    &:focus-visible {
      color: #174e46;
      outline: none;
      background: #f0f8f4;
    }

    span {
      font-size: 8px;
      font-weight: 650;
      color: #5a8a7d;
      letter-spacing: 0.08em;
    }

    strong {
      font-size: 13px;
      font-weight: 680;
    }

    small {
      font-size: 9px;
      line-height: 1.5;
      color: #7f908a;
    }
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
  .hospital-settings {
    grid-template-columns: 1fr;
  }

  .alarm-test-panel {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }

  .alarm-dispatch {
    grid-template-columns: 1fr 1fr;

    > .el-input {
      grid-column: 1 / -1;
    }
  }

  .pipeline-grid {
    grid-template-columns: 1fr;
  }

  .developer-live > div,
  .developer-shortcuts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .service-flow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 520px) {
  .hospital-settings form {
    grid-template-columns: 1fr;
  }

  .developer-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .developer-hero__signal {
    padding-left: 0;
    border-left: 0;
  }

  .alarm-dispatch {
    grid-template-columns: 1fr;

    > .el-input {
      grid-column: auto;
    }

    &__actions {
      flex-direction: column;
      align-items: stretch;
    }
  }

  .service-flow {
    grid-template-columns: 1fr;
  }

  .developer-live > div,
  .developer-shortcuts {
    grid-template-columns: 1fr;
  }

  .developer-live article {
    border-right: 0;
    border-bottom: 1px solid #e7eeeb;

    &:last-child {
      border-bottom: 0;
    }
  }
}
</style>
