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
        <el-button type="primary" @click="addBedVisible = true">新增床位</el-button>
      </div>
    </header>

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
            @open="openBed"
          />
        </div>
      </section>
    </div>

    <el-empty v-if="!roomGroups.length" description="当前筛选条件下没有床位">
      <el-button type="primary" @click="resetFilters">清除筛选</el-button>
    </el-empty>

    <AddBedDialog
      v-model="addBedVisible"
      :wards="store.currentWards"
      :rooms="store.rooms"
      @save="saveBed"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import AddBedDialog from "../components/AddBedDialog.vue";
import BedStatusCard from "../components/BedStatusCard.vue";
import { filterBedSummaries } from "../selectors";
import { useMonitoringStore } from "../store";
import type { AddBedInput, BedMonitorSummary, BedStatus } from "../types";

const router = useRouter();
const store = useMonitoringStore();

const selectedWard = ref(store.currentWards[0]?.id ?? "");
const selectedStatus = ref<BedStatus | "ALL">("ALL");
const query = ref("");
const addBedVisible = ref(false);
const generatedBedSetup = ref<BedMonitorSummary | null>(null);

const filteredSummaries = computed(() =>
  filterBedSummaries(store.bedSummaries, {
    wardId: selectedWard.value,
    status: selectedStatus.value,
    query: query.value,
  }),
);

const roomGroups = computed(() =>
  store.rooms
    .filter((room) => room.wardId === selectedWard.value)
    .map((room) => ({
      ...room,
      wardName: store.currentWards.find((ward) => ward.id === room.wardId)?.name ?? "",
      beds: filteredSummaries.value.filter((summary) => summary.bed.roomId === room.id),
    }))
    .filter((room) => room.beds.length),
);

function openBed(bedId: string): void {
  router.push(`/beds/${bedId}`);
}

function resetFilters(): void {
  selectedStatus.value = "ALL";
  query.value = "";
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
  gap: 16px;
  align-items: center;
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
}
</style>
