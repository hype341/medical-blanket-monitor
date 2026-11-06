<template>
  <div class="bed-list-page">
    <header class="bed-list-header">
      <div>
        <span>{{ store.hospital.name }}</span>
        <h1>床位监护</h1>
        <p>按授权病区查看床位、传感器状态和已绑定摄像头。</p>
      </div>
      <div class="bed-list-header__actions">
        <div class="bed-list-header__count">
          <strong>{{ filteredSummaries.length }}</strong>
          <span>张床位</span>
        </div>
        <el-button plain @click="copyShiftSummary">复制交班摘要</el-button>
        <el-button type="primary" @click="addBedVisible = true">新增床位</el-button>
      </div>
    </header>

    <section v-if="recentBeds.length" class="recent-beds" aria-label="最近查看床位">
      <span>最近查看</span>
      <button
        v-for="summary in recentBeds"
        :key="summary.bed.id"
        type="button"
        @click="openBed(summary.bed.id)"
      >
        <strong>{{ summary.room?.name }} · {{ summary.bed.bedNo }} 床</strong>
        <small>{{ summary.bed.patientName ?? "空床" }}</small>
      </button>
    </section>

    <section class="filter-bar" aria-label="床位筛选">
      <div class="filter-bar__wards">
        <button
          v-for="ward in store.currentWards"
          :key="ward.id"
          type="button"
          :class="{ 'is-active': selectedWard === ward.id }"
          @click="selectedWard = ward.id"
        >
          {{ ward.name }}
        </button>
      </div>
      <el-select v-model="selectedStatus" aria-label="床位状态" class="filter-bar__select">
        <el-option label="全部状态" value="ALL" />
        <el-option label="住院中" value="OCCUPIED" />
        <el-option label="空床" value="AVAILABLE" />
        <el-option label="清洁中" value="CLEANING" />
      </el-select>
      <el-input
        v-model="query"
        clearable
        placeholder="搜索病房、床位或患者"
        class="filter-bar__search"
      />
      <button
        type="button"
        class="filter-bar__quick filter-bar__quick--alarm"
        :class="{ 'is-active': alertOnly }"
        @click="alertOnly = !alertOnly"
      >
        待处理告警
        <b>{{ unresolvedSummaryCount }}</b>
      </button>
      <button
        type="button"
        class="filter-bar__quick filter-bar__quick--unbound"
        :class="{ 'is-active': unboundOnly }"
        @click="unboundOnly = !unboundOnly"
      >
        设备待绑定
        <b>{{ unboundSummaryCount }}</b>
      </button>
    </section>

    <section v-if="generatedBedSetup" class="generated-sensor-panel" aria-live="polite">
      <div class="generated-sensor-panel__identity">
        <span>已自动生成毯子传感器</span>
        <strong>{{ generatedBedSetup.sensor?.name }}</strong>
        <small>
          {{ generatedBedSetup.sensor?.deviceKey }} · 离线，收到首条 MQTT 数据后自动上线
        </small>
      </div>
      <div class="generated-sensor-panel__topic">
        <span>MQTT 数据主题</span>
        <code>{{ generatedBedSetup.dataTopic }}</code>
      </div>
      <el-button text @click="generatedBedSetup = null">关闭</el-button>
    </section>

    <div class="room-groups">
      <section v-for="room in roomGroups" :key="room.id" class="room-group">
        <header class="room-group__header">
          <div>
            <span>{{ room.wardName }}</span>
            <h2>{{ room.name }}</h2>
          </div>
          <span>{{ room.beds.length }} 张床位</span>
        </header>
        <div class="room-group__beds">
          <BedStatusCard
            v-for="summary in room.beds"
            :key="summary.bed.id"
            :summary="summary"
            :alarms="store.alarms.filter((alarm) => alarm.bedId === summary.bed.id)"
            :can-delete="store.canManageOrganization"
            @open="openBed"
            @delete="confirmDeleteBed"
          />
        </div>
      </section>
    </div>

    <el-empty v-if="!roomGroups.length" description="当前筛选条件下没有床位">
      <el-button type="primary" @click="resetFilters">清除筛选</el-button>
    </el-empty>

    <footer v-if="filteredSummaries.length" class="bed-list-footer">
      <span>
        当前显示 {{ pageStart + 1 }}–{{ Math.min(pageStart + pageSize, filteredSummaries.length) }}
        / {{ filteredSummaries.length }} 张床位
      </span>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[12, 24, 48, 96]"
        :total="filteredSummaries.length"
        layout="sizes, prev, pager, next"
        background
      />
    </footer>

    <AddBedDialog
      v-model="addBedVisible"
      :wards="store.currentWards"
      :rooms="store.rooms"
      @save="saveBed"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { copyText } from "@/utils/clipboard";
import AddBedDialog from "../components/AddBedDialog.vue";
import BedStatusCard from "../components/BedStatusCard.vue";
import { filterBedSummaries } from "../selectors";
import { useMonitoringStore } from "../store";
import { navigateToBedDetail } from "../navigation";
import type { AddBedInput, BedMonitorSummary, BedStatus } from "../types";

const router = useRouter();
const store = useMonitoringStore();

const selectedWard = ref(store.currentWards[0]?.id ?? "");
const selectedStatus = ref<BedStatus | "ALL">("ALL");
const query = ref("");
const addBedVisible = ref(false);
const generatedBedSetup = ref<BedMonitorSummary | null>(null);
const alertOnly = ref(false);
const unboundOnly = ref(false);
const currentPage = ref(1);
const pageSize = ref(12);
const recentIds = ref<string[]>(loadRecentBedIds());

function loadRecentBedIds(): string[] {
  try {
    const value = JSON.parse(
      localStorage.getItem("monitoring-recent-beds") ?? "[]",
    ) as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

const wardSummaries = computed(() =>
  filterBedSummaries(store.bedSummaries, {
    wardId: selectedWard.value,
    status: selectedStatus.value,
    query: query.value,
  }),
);
const unresolvedSummaryCount = computed(
  () =>
    wardSummaries.value.filter((summary) =>
      store.alarms.some((alarm) => alarm.bedId === summary.bed.id && alarm.status === "OPEN"),
    ).length,
);
const unboundSummaryCount = computed(
  () =>
    wardSummaries.value.filter((summary) => !summary.sensor || summary.cameras.length === 0)
      .length,
);
const filteredSummaries = computed(() =>
  wardSummaries.value.filter(
    (summary) =>
      (!alertOnly.value ||
        store.alarms.some(
          (alarm) => alarm.bedId === summary.bed.id && alarm.status === "OPEN",
        )) &&
      (!unboundOnly.value || !summary.sensor || summary.cameras.length === 0),
  ),
);
const pageStart = computed(() => (currentPage.value - 1) * pageSize.value);
const paginatedSummaries = computed(() =>
  filteredSummaries.value.slice(pageStart.value, pageStart.value + pageSize.value),
);
const recentBeds = computed(() =>
  recentIds.value
    .map((bedId) => store.bedSummaries.find((summary) => summary.bed.id === bedId))
    .filter((summary): summary is BedMonitorSummary => Boolean(summary))
    .slice(0, 4),
);

const roomGroups = computed(() =>
  store.rooms
    .filter((room) => room.wardId === selectedWard.value)
    .map((room) => ({
      ...room,
      wardName: store.currentWards.find((ward) => ward.id === room.wardId)?.name ?? "",
      beds: paginatedSummaries.value.filter((summary) => summary.bed.roomId === room.id),
    }))
    .filter((room) => room.beds.length),
);

async function openBed(bedId: string): Promise<void> {
  recentIds.value = [bedId, ...recentIds.value.filter((item) => item !== bedId)].slice(0, 8);
  localStorage.setItem("monitoring-recent-beds", JSON.stringify(recentIds.value));
  await navigateToBedDetail(router, bedId);
}

function resetFilters(): void {
  selectedStatus.value = "ALL";
  query.value = "";
  alertOnly.value = false;
  unboundOnly.value = false;
  currentPage.value = 1;
}

watch([selectedWard, selectedStatus, query, alertOnly, unboundOnly, pageSize], () => {
  currentPage.value = 1;
});

async function copyShiftSummary(): Promise<void> {
  const currentWard = store.currentWards.find((ward) => ward.id === selectedWard.value);
  const summaries = store.bedSummaries.filter(
    (summary) => summary.bed.wardId === selectedWard.value,
  );
  const openAlarms = store.alarms.filter(
    (alarm) =>
      alarm.status === "OPEN" &&
      summaries.some((summary) => summary.bed.id === alarm.bedId),
  );
  const alertBeds = summaries.filter((summary) =>
    openAlarms.some((alarm) => alarm.bedId === summary.bed.id),
  );
  const unboundBeds = summaries.filter(
    (summary) => !summary.sensor || summary.cameras.length === 0,
  );
  const lines = [
    `${store.hospital.name} · ${currentWard?.name ?? "当前病区"}交班摘要`,
    `时间：${new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date())}`,
    `监护床位：${summaries.length} 张；传感器在线：${summaries.filter((item) => item.sensor?.status === "ONLINE").length} 张`,
    `未处理告警：${openAlarms.length} 条；设备待补：${unboundBeds.length} 张`,
    alertBeds.length ? "告警床位：" : "告警床位：无",
    ...alertBeds.map(
      (summary) =>
        `- ${summary.room?.name ?? ""} ${summary.bed.bedNo} 床 ${summary.bed.patientName ?? "空床"}`,
    ),
    unboundBeds.length ? "设备待补床位：" : "设备待补床位：无",
    ...unboundBeds.map(
      (summary) =>
        `- ${summary.room?.name ?? ""} ${summary.bed.bedNo} 床：${!summary.sensor ? "缺少毯子传感器" : "缺少摄像头"}`,
    ),
  ];
  try {
    await copyText(lines.join("\n"));
    ElMessage.success("交班摘要已复制");
  } catch {
    ElMessage.error("交班摘要复制失败，请检查浏览器权限");
  }
}

async function confirmDeleteBed(bedId: string): Promise<void> {
  const summary = store.bedSummaries.find((item) => item.bed.id === bedId);
  if (!summary) return;
  try {
    await ElMessageBox.confirm(
      `确定删除 ${summary.room?.name ?? ""} ${summary.bed.bedNo} 床吗？该床毯子、绑定和已解决告警记录会一并清理。`,
      "删除床位",
      {
        confirmButtonText: "删除床位",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    store.deleteBed(bedId);
    if (generatedBedSetup.value?.bed.id === bedId) generatedBedSetup.value = null;
    ElMessage.success("床位已删除");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "床位删除失败");
  }
}

function saveBed(input: AddBedInput): void {
  try {
    const bedId = store.addBed(input);
    generatedBedSetup.value = store.bedSummaries.find((item) => item.bed.id === bedId) ?? null;
    addBedVisible.value = false;
    ElMessage.success("床位已添加，毯子传感器与 MQTT 主题已生成");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "床位添加失败");
  }
}
</script>

<style scoped lang="scss">
.bed-list-page {
  color: #173c3a;
}

.bed-list-header {
  display: flex;
  gap: 24px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 6px 2px 22px;
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

.bed-list-header__count {
  display: flex;
  gap: 6px;
  align-items: baseline;
  color: #507068;

  strong {
    font-family: "Avenir Next", sans-serif;
    font-size: 35px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

.bed-list-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: flex-end;
}

.recent-beds {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 12px 0 2px;
  overflow-x: auto;

  > span {
    flex-shrink: 0;
    margin-right: 4px;
    font-size: 11px;
    font-weight: 650;
    color: #71847e;
  }

  button {
    display: grid;
    flex-shrink: 0;
    gap: 2px;
    padding: 7px 10px;
    color: #255f53;
    text-align: left;
    cursor: pointer;
    background: #f2f8f5;
    border: 1px solid #d6e5df;

    &:hover,
    &:focus-visible {
      outline: none;
      background: #e8f4ef;
      border-color: #8eb9aa;
    }
  }

  strong {
    font-size: 11px;
  }

  small {
    font-size: 10px;
    color: #7a8d87;
  }
}

.generated-sensor-panel {
  display: grid;
  grid-template-columns: minmax(220px, 0.85fr) minmax(0, 1.15fr) auto;
  gap: 16px;
  align-items: center;
  padding: 13px 15px;
  margin-top: 4px;
  background: linear-gradient(100deg, #edf8f3, #fbfdfc 72%);
  border: 1px solid #cfe3dc;
  border-left: 3px solid #2f806a;
}

.generated-sensor-panel__identity,
.generated-sensor-panel__topic {
  display: grid;
  gap: 3px;
  min-width: 0;

  span {
    font-size: 9px;
    font-weight: 650;
    color: #58796f;
  }

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
    font-weight: 650;
    color: #235d50;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 9px;
    color: #789087;
    white-space: nowrap;
  }
}

.generated-sensor-panel__topic {
  code {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    color: #2c6c5e;
    white-space: nowrap;
  }
}

.filter-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 16px 0;
}

.filter-bar__wards {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: #e8f0ed;

  button {
    padding: 8px 13px;
    font-size: 12px;
    color: #58716b;
    cursor: pointer;
    background: transparent;
    border: 0;

    &.is-active {
      font-weight: 650;
      color: #174e46;
      background: #fff;
      box-shadow: 0 1px 4px rgb(13 63 60 / 10%);
    }

    &:focus-visible {
      outline: 2px solid #2f806a;
      outline-offset: 2px;
    }
  }
}

.filter-bar__select {
  width: 130px;
}

.filter-bar__search {
  width: 240px;
  margin-left: auto;
}

.filter-bar__quick {
  display: inline-flex;
  flex-shrink: 0;
  gap: 6px;
  align-items: center;
  padding: 8px 10px;
  font-size: 11px;
  color: #526b64;
  cursor: pointer;
  background: #fff;
  border: 1px solid #d7e3df;

  b {
    display: grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    font-family: "Avenir Next", sans-serif;
    font-size: 10px;
    color: #fff;
    background: #8a9894;
    border-radius: 99px;
  }

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: #87ad9f;
  }

  &--alarm.is-active {
    color: #9e3028;
    background: #fff5f3;
    border-color: #dba6a0;

    b {
      background: #b83b33;
    }
  }

  &--unbound.is-active {
    color: #825c12;
    background: #fff9e8;
    border-color: #dcc687;

    b {
      background: #a77718;
    }
  }
}

.room-groups {
  display: grid;
  gap: 24px;
}

.room-group__header {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: 9px;
  margin-bottom: 10px;
  border-bottom: 1px solid #e1e9e6;

  span {
    font-size: 11px;
    color: #7b8b87;
  }

  h2 {
    margin: 3px 0 0;
    font-size: 16px;
    font-weight: 650;
  }
}

.room-group__beds {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
  gap: 12px;
}

.bed-list-footer {
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: space-between;
  padding: 15px 0 0;
  margin-top: 18px;
  border-top: 1px solid #dfe8e4;

  > span {
    font-size: 11px;
    color: #72847e;
  }
}

@media (width <= 900px) {
  .generated-sensor-panel {
    grid-template-columns: 1fr auto;

    .generated-sensor-panel__topic {
      grid-row: 2;
      grid-column: 1 / -1;
    }
  }

  .filter-bar {
    flex-wrap: wrap;
    align-items: stretch;
  }

  .filter-bar__wards {
    width: 100%;
    overflow-x: auto;
  }

  .filter-bar__search {
    flex: 1;
    width: auto;
    margin-left: 0;
  }

  .bed-list-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (width <= 600px) {
  .bed-list-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .bed-list-header__actions {
    justify-content: space-between;
    width: 100%;
  }

  .generated-sensor-panel {
    grid-template-columns: 1fr auto;

    strong,
    small,
    code {
      overflow-wrap: anywhere;
      white-space: normal;
    }
  }

  .filter-bar__select,
  .filter-bar__search {
    width: 100%;
  }

  .filter-bar__quick {
    flex: 1;
    justify-content: center;
  }

  .bed-list-header__count {
    margin-right: auto;
  }

  .bed-list-footer {
    overflow-x: auto;
  }
}
</style>
