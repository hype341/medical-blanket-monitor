<template>
  <div class="overview-page">
    <header class="overview-hero">
      <div>
        <span class="overview-hero__hospital">{{ store.hospital.name }} · 护士站监护视图</span>
        <h1>安全总览</h1>
        <p>集中查看授权病区的床位、毯子传感器与视频设备状态。</p>
      </div>
      <div class="overview-hero__clock">
        <span>当前值班</span>
        <strong>{{ currentTime }}</strong>
        <small>{{ currentDate }}</small>
      </div>
    </header>

    <section class="stat-strip" aria-label="监护状态统计">
      <div v-for="stat in stats" :key="stat.label" class="stat-strip__item">
        <span>{{ stat.label }}</span>
        <strong>{{ stat.value }}</strong>
        <small>{{ stat.caption }}</small>
      </div>
    </section>

    <div class="overview-grid">
      <section class="ward-board">
        <header class="section-heading">
          <div>
            <h2>病区监护地图</h2>
            <p>每间病房按床位排列，颜色表示当前传感器状态。</p>
          </div>
          <el-button text type="primary" @click="router.push('/beds')">进入床位监护</el-button>
        </header>

        <div class="ward-board__wards">
          <article v-for="ward in wardBoards" :key="ward.id" class="ward-column">
            <header>
              <div>
                <span>{{ ward.code }}</span>
                <h3>{{ ward.name }}</h3>
              </div>
              <strong>{{ ward.onlineCount }}/{{ ward.bedCount }}</strong>
            </header>
            <div class="ward-column__rooms">
              <div v-for="room in ward.rooms" :key="room.id" class="room-row">
                <span class="room-row__name">{{ room.name }}</span>
                <div class="room-row__beds">
                  <button
                    v-for="summary in room.beds"
                    :key="summary.bed.id"
                    type="button"
                    class="bed-chip"
                    :data-status="summary.sensor?.status ?? 'OFFLINE'"
                    @click="router.push(`/beds/${summary.bed.id}`)"
                  >
                    <span>{{ summary.bed.bedNo }}</span>
                    <small>{{ summary.bed.patientName ?? "空床" }}</small>
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <aside class="attention-panel">
        <header class="section-heading">
          <div>
            <h2>需要关注</h2>
            <p>按设备风险优先级排列。</p>
          </div>
        </header>
        <div class="attention-panel__list">
          <button
            v-for="item in attentionItems"
            :key="item.id"
            type="button"
            class="attention-item"
            :data-tone="item.tone"
            @click="router.push(`/beds/${item.bedId}`)"
          >
            <span class="attention-item__mark" />
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.detail }}</p>
            </div>
            <span>{{ item.time }}</span>
          </button>
        </div>
      </aside>
    </div>

    <section class="module-directory">
      <header class="section-heading">
        <div>
          <h2>功能模块</h2>
          <p>当前账号可打开的页面集中排列，点击直接进入。</p>
        </div>
      </header>
      <div class="module-directory__list">
        <button
          v-for="module in moduleLinks"
          :key="module.path"
          type="button"
          @click="router.push(module.path)"
        >
          <span>{{ module.kind }}</span>
          <div>
            <strong>{{ module.label }}</strong>
            <small>{{ module.description }}</small>
          </div>
          <i>打开</i>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useMonitoringStore } from "../store";

const router = useRouter();
const store = useMonitoringStore();

const now = new Date();
const currentTime = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(now);
const currentDate = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(now);

const summaries = computed(() => store.bedSummaries);

const stats = computed(() => {
  const onlineSensors = summaries.value.filter((item) => item.sensor?.status === "ONLINE").length;
  const onlineCameras = summaries.value.reduce(
    (count, item) => count + item.cameras.filter((camera) => camera.status === "ONLINE").length,
    0,
  );
  const attention = summaries.value.filter(
    (item) =>
      item.sensor?.status === "ALARM" ||
      item.sensor?.status === "OFFLINE" ||
      item.sensor?.status === "STALE",
  ).length;

  return [
    { label: "当前监护床位", value: summaries.value.length, caption: "已授权病区" },
    { label: "传感器在线", value: onlineSensors, caption: "设备连接正常" },
    { label: "视频设备在线", value: onlineCameras, caption: "可调阅摄像画面" },
    { label: "需要关注", value: attention, caption: "异常、离线或数据延迟" },
  ];
});

const wardBoards = computed(() =>
  store.currentWards.map((ward) => {
    const wardSummaries = summaries.value.filter((item) => item.bed.wardId === ward.id);
    const rooms = store.rooms
      .filter((room) => room.wardId === ward.id)
      .map((room) => ({
        ...room,
        beds: wardSummaries.filter((item) => item.bed.roomId === room.id),
      }))
      .filter((room) => room.beds.length);

    return {
      ...ward,
      bedCount: wardSummaries.length,
      onlineCount: wardSummaries.filter((item) => item.sensor?.status === "ONLINE").length,
      rooms,
    };
  }),
);

const attentionItems = computed(() => {
  const alarmItems = store.alarms
    .filter((alarm) => alarm.status !== "RESOLVED")
    .map((alarm) => {
      const summary = summaries.value.find((item) => item.bed.id === alarm.bedId);
      return {
        id: alarm.alarmId,
        bedId: alarm.bedId,
        title: `${alarm.title} · ${summary?.room?.name ?? ""} ${summary?.bed.bedNo ?? ""}床`,
        detail: alarm.detail,
        tone: "alert" as const,
        time: new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(alarm.occurredAt)),
      };
    });
  const sensorItems = summaries.value
    .filter((item) => item.sensor && item.sensor.status !== "ONLINE")
    .map((item) => {
      const tone =
        item.sensor?.status === "ALARM"
          ? "alert"
          : item.sensor?.status === "STALE"
            ? "warning"
            : "offline";
      const title =
        item.sensor?.status === "ALARM"
          ? "毯子传感器状态异常"
          : item.sensor?.status === "STALE"
            ? "传感器数据更新延迟"
            : "毯子传感器离线";
      return {
        id: item.bed.id,
        bedId: item.bed.id,
        title,
        detail: `${item.room?.name ?? ""} ${item.bed.bedNo} 床 · ${item.bed.patientName ?? "空床"}`,
        tone,
        time: new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(item.bed.updatedAt)),
      };
    });

  return [...alarmItems, ...sensorItems];
});

const moduleLinks = computed(() => {
  const links = [
    {
      path: "/beds",
      kind: "监护",
      label: "床位监护",
      description: "查看病房、床位、患者、视频和传感器图形",
      visible: store.canAccessModule("beds"),
    },
    {
      path: "/bindings",
      kind: "设备",
      label: "设备绑定",
      description: "查看床位与传感器、摄像头的对应关系",
      visible: store.canAccessModule("bindings"),
    },
    {
      path: "/devices/cameras",
      kind: "视频",
      label: "视频管理",
      description: "维护摄像头、直接观看地址和回放索引",
      visible: store.canAccessModule("video"),
    },
    {
      path: "/admin/management",
      kind: "行政",
      label: "管理设置",
      description: "病区病房、人员权限、告警与录像策略",
      visible: store.activeRole === "ADMIN" || store.activeRole === "DEVELOPER",
    },
    {
      path: "/admin/connections",
      kind: "数据",
      label: "MQTT 管理",
      description: "床位数据主题、床位告警主题和在线文档",
      visible: store.canAccessModule("mqtt"),
    },
    {
      path: "/admin/developer",
      kind: "开发",
      label: "开发者概览",
      description: "查看数据管线、服务状态和运行信息",
      visible: store.canAccessModule("developer"),
    },
  ];
  return links.filter((link) => link.visible);
});
</script>

<style scoped lang="scss">
.overview-page {
  --monitor-ink: #173c3a;
  --monitor-deep: #0b4541;
  --monitor-muted: #6e817c;
  --monitor-line: #dbe6e2;
  --monitor-paper: #f5f8f6;
  color: var(--monitor-ink);
}

.overview-hero {
  display: flex;
  gap: 32px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 26px 30px;
  background:
    linear-gradient(90deg, rgb(220 236 230 / 82%), rgb(247 250 248 / 92%)),
    repeating-linear-gradient(90deg, transparent 0 31px, rgb(11 69 65 / 4%) 31px 32px);
  border-left: 6px solid #236f61;

  h1 {
    margin: 8px 0 6px;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: clamp(30px, 3vw, 46px);
    font-weight: 650;
    line-height: 1;
    letter-spacing: -0.045em;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: var(--monitor-muted);
  }
}

.overview-hero__hospital {
  font-size: 12px;
  font-weight: 700;
  color: #2c6e60;
  letter-spacing: 0.08em;
}

.overview-hero__clock {
  display: grid;
  gap: 3px;
  min-width: 170px;
  text-align: right;

  span,
  small {
    font-size: 11px;
    color: var(--monitor-muted);
  }

  strong {
    font-family: "Avenir Next", sans-serif;
    font-size: 35px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.04em;
  }
}

.stat-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 18px;
  background: #fff;
  border: 1px solid var(--monitor-line);
}

.stat-strip__item {
  display: grid;
  gap: 5px;
  padding: 20px 22px;
  border-right: 1px solid var(--monitor-line);

  &:last-child {
    border-right: 0;
  }

  span,
  small {
    font-size: 11px;
    color: var(--monitor-muted);
  }

  strong {
    font-family: "Avenir Next", sans-serif;
    font-size: 30px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 18px;
  margin-top: 18px;
}

.ward-board,
.attention-panel {
  padding: 22px;
  background: #fff;
  border: 1px solid var(--monitor-line);
}

.section-heading {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 650;
  }

  p {
    margin: 5px 0 0;
    font-size: 12px;
    color: var(--monitor-muted);
  }
}

.ward-board__wards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.ward-column {
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: #eef5f2;

    span {
      font-size: 10px;
      font-weight: 700;
      color: #4e736a;
      letter-spacing: 0.08em;
    }

    h3 {
      margin: 3px 0 0;
      font-size: 15px;
      font-weight: 650;
    }

    strong {
      font-family: "Avenir Next", sans-serif;
      font-size: 20px;
      color: #2b7061;
    }
  }
}

.ward-column__rooms {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.room-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.room-row__name {
  font-size: 11px;
  color: #72847f;
}

.room-row__beds {
  display: flex;
  gap: 7px;
}

.bed-chip {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
  padding: 9px 10px;
  color: #173c3a;
  text-align: left;
  cursor: pointer;
  background: #fbfdfc;
  border: 1px solid #d4e2dd;
  border-left: 3px solid #347d6a;
  border-radius: 2px;

  &[data-status="ALARM"] {
    background: #fff8f7;
    border-left-color: #c84a3f;
  }

  &[data-status="STALE"] {
    background: #fff5f3;
    border-left-color: #c84a3f;
  }

  &[data-status="OFFLINE"] {
    background: #f8faf9;
    border-left-color: #8b9794;
  }

  &:focus-visible {
    outline: 2px solid #2f806a;
    outline-offset: 2px;
  }

  span {
    font-size: 13px;
    font-weight: 650;
  }

  small {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 10px;
    color: #71837e;
    white-space: nowrap;
  }
}

.attention-panel__list {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}

.attention-item {
  display: grid;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 12px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: #fbfcfb;
  border: 1px solid #e4ebe8;

  &[data-tone="alert"] .attention-item__mark {
    background: #c84a3f;
  }

  &[data-tone="warning"] .attention-item__mark {
    background: #c84a3f;
  }

  &[data-tone="offline"] .attention-item__mark {
    background: #8b9794;
  }

  strong {
    font-size: 12px;
  }

  p {
    margin: 4px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #74847f;
  }

  > span:last-child {
    font-family: "Avenir Next", sans-serif;
    font-size: 10px;
    color: #899792;
  }
}

.attention-item__mark {
  width: 4px;
  height: 30px;
  background: #347d6a;
  border-radius: 2px;
}

.module-directory {
  padding: 20px;
  margin-top: 18px;
  background: #fff;
  border: 1px solid var(--monitor-line);
}

.module-directory__list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;

  button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 12px;
    color: #173c3a;
    text-align: left;
    cursor: pointer;
    background: #f8fbfa;
    border: 1px solid #e0e9e5;
    transition:
      border-color 150ms ease,
      background-color 150ms ease;

    &:hover,
    &:focus-visible {
      outline: none;
      background: #edf7f2;
      border-color: #9cc1b5;
    }

    > span {
      padding: 4px 6px;
      font-size: 8px;
      font-weight: 700;
      color: #3d7568;
      background: #e4f1eb;
    }

    div {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    strong {
      font-size: 11px;
    }

    small {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 9px;
      color: #7a8b86;
      white-space: nowrap;
    }

    i {
      font-size: 9px;
      font-style: normal;
      color: #2f806a;
    }
  }
}

@media (width <= 1100px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .stat-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-strip__item:nth-child(2) {
    border-right: 0;
  }

  .stat-strip__item:nth-child(-n + 2) {
    border-bottom: 1px solid var(--monitor-line);
  }

  .module-directory__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 760px) {
  .overview-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .overview-hero__clock {
    text-align: left;
  }

  .ward-board__wards {
    grid-template-columns: 1fr;
  }

  .module-directory__list {
    grid-template-columns: 1fr;
  }
}
</style>
