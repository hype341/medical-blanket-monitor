<template>
  <div class="blanket-page">
    <header class="blanket-header">
      <div>
        <span>{{ store.hospital.name }} · 设备档案</span>
        <h1>毯子管理</h1>
        <p>统一维护毯子名称和对应床位，名称会自动同步到 MQTT 管理中的设备信息。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建毯子</el-button>
    </header>

    <section class="blanket-summary" aria-label="毯子概况">
      <div>
        <strong>{{ rows.length }}</strong>
        <span>全部毯子</span>
      </div>
      <div>
        <strong>{{ assignedCount }}</strong>
        <span>已分配床位</span>
      </div>
      <div>
        <strong>{{ rows.length - assignedCount }}</strong>
        <span>等待分配</span>
      </div>
    </section>

    <section class="blanket-register">
      <header>
        <div>
          <span>设备清单</span>
          <h2>名称与床位对应关系</h2>
        </div>
        <small>名称修改后，MQTT 页面同步显示新名称</small>
      </header>

      <div class="blanket-filters">
        <el-input
          v-model="query"
          clearable
          placeholder="搜索毯子名称、设备标识、病房、床位或患者"
        />
        <el-select v-model="statusFilter" aria-label="毯子状态">
          <el-option label="全部状态" value="ALL" />
          <el-option label="在线" value="ONLINE" />
          <el-option label="数据延迟" value="STALE" />
          <el-option label="离线" value="OFFLINE" />
          <el-option label="告警" value="ALARM" />
        </el-select>
        <span>已筛选 {{ filteredRows.length }} / {{ rows.length }} 条</span>
      </div>

      <div v-if="filteredRows.length" class="blanket-list">
        <article v-for="row in pagedRows" :key="row.sensor.id" class="blanket-row">
          <div class="blanket-row__name">
            <span :data-status="row.sensor.status" />
            <div>
              <strong>{{ row.sensor.name }}</strong>
              <small>{{ statusLabel[row.sensor.status] }}</small>
            </div>
          </div>
          <div class="blanket-row__location">
            <span>对应床位</span>
            <strong v-if="row.bed">
              {{ row.ward?.name }} / {{ row.room?.name }} / {{ row.bed.bedNo }} 床
            </strong>
            <strong v-else class="is-unassigned">未分配床位</strong>
          </div>
          <div class="blanket-row__actions">
            <el-button text type="primary" @click="openEdit(row.sensor.id)">编辑毯子</el-button>
            <el-button text type="danger" @click="confirmDelete(row.sensor.id)">删除</el-button>
          </div>
        </article>
      </div>
      <el-empty v-else description="还没有毯子，先新建一条">
        <el-button v-if="!rows.length" type="primary" @click="openCreate">新建毯子</el-button>
        <el-button v-else @click="resetFilters">清除筛选</el-button>
      </el-empty>
    </section>

    <footer v-if="filteredRows.length" class="blanket-footer">
      <span>设备档案按页加载，搜索会匹配名称、设备标识和床位信息。</span>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[12, 24, 48, 96]"
        :total="filteredRows.length"
        layout="sizes, prev, pager, next"
        background
      />
    </footer>

    <aside v-if="lastSyncedName" class="blanket-sync-note" aria-live="polite">
      <span>已同步</span>
      <strong>{{ lastSyncedName }}</strong>
      <small>名称已同步到 MQTT</small>
    </aside>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑毯子' : '新建毯子'"
      width="520px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="毯子名称">
          <el-input
            v-model.trim="form.name"
            aria-label="毯子名称"
            maxlength="40"
            placeholder="例如：01 床保暖毯"
          />
        </el-form-item>
        <el-form-item label="对应床位">
          <el-select
            v-model="form.bedId"
            filterable
            aria-label="对应床位"
            class="w-full"
            placeholder="选择病区、病房和床位"
          >
            <el-option
              v-for="bed in bedOptions"
              :key="bed.id"
              :label="bed.label"
              :value="bed.id"
            />
          </el-select>
        </el-form-item>
        <p class="blanket-form-note">保存后，原床位的毯子会解除关联，摄像头绑定不受影响。</p>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!form.name.trim() || !form.bedId" @click="save">
          保存毯子
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useMonitoringStore } from "../store";
import type { SensorStatus } from "../types";

const store = useMonitoringStore();
const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const lastSyncedName = ref("");
const query = ref("");
const statusFilter = ref<"ALL" | SensorStatus>("ALL");
const currentPage = ref(1);
const pageSize = ref(12);
const form = reactive({
  name: "",
  bedId: "",
});

const statusLabel: Record<SensorStatus, string> = {
  ONLINE: "在线",
  OFFLINE: "离线",
  STALE: "数据延迟",
  ALARM: "告警",
};

const bedOptions = computed(() => {
  const wardsById = new Map(store.wards.map((ward) => [ward.id, ward]));
  const roomsById = new Map(store.rooms.map((room) => [room.id, room]));
  return store.beds
    .map((bed) => {
      const ward = wardsById.get(bed.wardId);
      const room = roomsById.get(bed.roomId);
      return {
        id: bed.id,
        label: `${ward?.name ?? "未分病区"} / ${room?.name ?? "未分病房"} / ${bed.bedNo} 床`,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
});

const rows = computed(() => {
  const bedsById = new Map(store.beds.map((bed) => [bed.id, bed]));
  const roomsById = new Map(store.rooms.map((room) => [room.id, room]));
  const wardsById = new Map(store.wards.map((ward) => [ward.id, ward]));
  const sensorBindingBySensor = new Map<string, (typeof store.bindings)[number]>();
  for (const binding of store.bindings) {
    if (
      binding.status === "ACTIVE" &&
      binding.role === "PRIMARY_SENSOR" &&
      binding.sensorDeviceId
    ) {
      sensorBindingBySensor.set(binding.sensorDeviceId, binding);
    }
  }

  return store.sensors
    .map((sensor) => {
      const binding = sensorBindingBySensor.get(sensor.id);
      const bed = binding ? bedsById.get(binding.bedId) : undefined;
      const room = bed ? roomsById.get(bed.roomId) : undefined;
      const ward = bed ? wardsById.get(bed.wardId) : undefined;
      return { sensor, bed, room, ward };
    })
    .sort((left, right) => {
      if (Boolean(left.bed) !== Boolean(right.bed)) return left.bed ? -1 : 1;
      return left.sensor.name.localeCompare(right.sensor.name);
    });
});

const assignedCount = computed(() => rows.value.filter((row) => Boolean(row.bed)).length);
const filteredRows = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  return rows.value.filter((row) => {
    if (statusFilter.value !== "ALL" && row.sensor.status !== statusFilter.value) return false;
    if (!keyword) return true;
    return [
      row.sensor.name,
      row.sensor.deviceKey,
      row.ward?.name,
      row.room?.name,
      row.bed?.bedNo,
      row.bed?.patientName,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(keyword));
  });
});
const pageStart = computed(() => (currentPage.value - 1) * pageSize.value);
const pagedRows = computed(() =>
  filteredRows.value.slice(pageStart.value, pageStart.value + pageSize.value),
);

watch([query, statusFilter, pageSize], () => {
  currentPage.value = 1;
});

function resetFilters(): void {
  query.value = "";
  statusFilter.value = "ALL";
  currentPage.value = 1;
}

function openCreate(): void {
  editingId.value = null;
  form.name = "";
  form.bedId = bedOptions.value[0]?.id ?? "";
  dialogVisible.value = true;
}

function openEdit(sensorId: string): void {
  const row = rows.value.find((item) => item.sensor.id === sensorId);
  if (!row) return;
  editingId.value = sensorId;
  form.name = row.sensor.name;
  form.bedId = row.bed?.id ?? "";
  dialogVisible.value = true;
}

function save(): void {
  try {
    if (editingId.value) {
      store.updateBlanket(editingId.value, { ...form });
    } else {
      store.addBlanket({ ...form });
    }
    lastSyncedName.value = form.name.trim();
    dialogVisible.value = false;
    ElMessage.success("保存成功，名称已同步到 MQTT");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "毯子保存失败");
  }
}

async function confirmDelete(sensorId: string): Promise<void> {
  const sensor = store.sensors.find((item) => item.id === sensorId);
  if (!sensor) return;
  try {
    await ElMessageBox.confirm(
      `确定删除“${sensor.name}”吗？对应床位上的毯子绑定会自动解除。`,
      "删除毯子",
      {
        confirmButtonText: "删除毯子",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    store.deleteBlanket(sensorId);
    if (editingId.value === sensorId) dialogVisible.value = false;
    ElMessage.success("毯子已删除");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "毯子删除失败");
  }
}
</script>

<style scoped lang="scss">
.blanket-page {
  color: #173c3a;
}

.blanket-header {
  display: flex;
  gap: 24px;
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

.blanket-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 14px;
  background: #fff;
  border: 1px solid #dbe6e2;

  div {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 13px 16px;
    border-right: 1px solid #e4ece9;

    &:last-child {
      border-right: 0;
    }
  }

  strong {
    font-family: "Avenir Next", sans-serif;
    font-size: 24px;
    font-weight: 600;
    color: #28695b;
  }

  span {
    font-size: 10px;
    color: #7a8e87;
  }
}

.blanket-register {
  margin-top: 14px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 16px;
    align-items: flex-end;
    justify-content: space-between;
    padding: 16px 18px 12px;
    border-bottom: 1px solid #e5ece9;

    span,
    small {
      font-size: 9px;
      color: #7e8f89;
    }

    h2 {
      margin: 3px 0 0;
      font-size: 16px;
      font-weight: 680;
    }
  }
}

.blanket-list {
  display: grid;
}

.blanket-filters {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid #e8eeeb;

  .el-input {
    max-width: 460px;
  }

  .el-select {
    width: 130px;
  }

  > span {
    margin-left: auto;
    font-size: 11px;
    color: #71847e;
  }
}

.blanket-row {
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(280px, 1.4fr) auto;
  gap: 18px;
  align-items: center;
  padding: 13px 18px;
  border-bottom: 1px solid #edf1ef;

  &:last-child {
    border-bottom: 0;
  }
}

.blanket-row__name {
  display: flex;
  gap: 10px;
  align-items: center;

  > span {
    width: 8px;
    height: 8px;
    background: #8f9d99;
    border-radius: 50%;

    &[data-status="ONLINE"] {
      background: #3a9e77;
    }

    &[data-status="ALARM"] {
      background: #c7463b;
    }

    &[data-status="STALE"] {
      background: #c58a35;
    }
  }

  div,
  .blanket-row__location {
    display: grid;
    gap: 3px;
  }

  strong {
    font-size: 12px;
    color: #275f53;
  }

  small,
  .blanket-row__location span {
    font-size: 9px;
    color: #82918c;
  }
}

.blanket-row__actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.blanket-row__location {
  display: grid;
  gap: 3px;

  span {
    font-size: 8px;
    color: #82918c;
  }

  strong {
    font-size: 11px;
    font-weight: 600;
    color: #475f58;
  }

  .is-unassigned {
    color: #9b722b;
  }
}

.blanket-sync-note {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 11px 14px;
  margin-top: 10px;
  background: #edf8f3;
  border-left: 3px solid #2f806a;

  span,
  small {
    font-size: 9px;
    color: #628178;
  }

  strong {
    font-size: 11px;
    color: #275f53;
  }
}

.blanket-footer {
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

.blanket-form-note {
  margin: 0;
  font-size: 10px;
  line-height: 1.6;
  color: #87958f;
}

@media (width <= 700px) {
  .blanket-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .blanket-summary div {
    padding: 11px;
  }

  .blanket-row {
    grid-template-columns: 1fr auto;

    > .blanket-row__actions {
      grid-row: 1;
      grid-column: 2;
    }
  }

  .blanket-row__location {
    grid-column: 1 / -1;
  }

  .blanket-filters,
  .blanket-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .blanket-filters .el-input,
  .blanket-filters .el-select {
    width: 100%;
    max-width: none;
  }

  .blanket-filters > span {
    margin-left: 0;
  }
}
</style>
