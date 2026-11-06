<template>
  <div class="organization-page">
    <header class="admin-page-header">
      <div>
        <span>{{ store.hospital.name }} · 管理中心</span>
        <h1>病区与病房管理</h1>
        <p>维护病区编码、名称和病房房号，床位与人员权限都使用这里的组织结构。</p>
      </div>
      <el-button type="primary" @click="openWardEditor()">新增病区</el-button>
    </header>

    <div class="organization-grid">
      <section class="ward-panel">
        <header>
          <h2>病区</h2>
          <span>{{ store.wards.length }} 个</span>
        </header>
        <button
          v-for="ward in store.wards"
          :key="ward.id"
          type="button"
          class="ward-item"
          :class="{ 'is-active': selectedWardId === ward.id }"
          @click="selectedWardId = ward.id"
        >
          <div>
            <small>{{ ward.code }}</small>
            <strong>{{ ward.name }}</strong>
          </div>
          <span>{{ roomCount(ward.id) }} 间病房</span>
        </button>
      </section>

      <section class="room-panel">
        <header>
          <div>
            <span>{{ selectedWard?.code }}</span>
            <h2>{{ selectedWard?.name ?? "请选择病区" }}</h2>
          </div>
          <div class="room-panel__actions">
            <el-button :disabled="!selectedWard" @click="openWardEditor(selectedWard?.id)">
              编辑病区
            </el-button>
            <el-button
              type="danger"
              plain
              :disabled="!selectedWard"
              @click="selectedWard && confirmDeleteWard(selectedWard.id)"
            >
              删除病区
            </el-button>
            <el-button type="primary" :disabled="!selectedWard" @click="openRoomEditor()">
              新增病房
            </el-button>
          </div>
        </header>

        <div class="room-list">
          <article v-for="room in selectedRooms" :key="room.id" class="room-card">
            <div class="room-card__number">{{ room.roomNo }}</div>
            <div class="room-card__body">
              <strong>{{ room.name }}</strong>
              <span>{{ bedCount(room.id) }} 张床位</span>
            </div>
            <div class="room-card__actions">
              <el-button text type="primary" @click="openRoomEditor(room.id)">编辑病房</el-button>
              <el-button text type="danger" @click="confirmDeleteRoom(room.id)">删除</el-button>
            </div>
          </article>
          <el-empty v-if="!selectedRooms.length" description="该病区还没有病房" />
        </div>
      </section>
    </div>

    <el-dialog
      v-model="wardEditorVisible"
      :title="editingWardId ? '编辑病区' : '新增病区'"
      width="460px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="病区编码">
          <el-input v-model.trim="wardForm.code" placeholder="病区编码" maxlength="30" />
        </el-form-item>
        <el-form-item label="病区名称">
          <el-input v-model.trim="wardForm.name" placeholder="病区名称" maxlength="40" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="wardEditorVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!wardForm.code || !wardForm.name" @click="saveWard">
          保存病区
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="roomEditorVisible"
      :title="editingRoomId ? '编辑病房' : '新增病房'"
      width="460px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="房号">
          <el-input v-model.trim="roomForm.roomNo" placeholder="房号" maxlength="20" />
        </el-form-item>
        <el-form-item label="病房名称">
          <el-input v-model.trim="roomForm.name" placeholder="病房名称" maxlength="40" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roomEditorVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!roomForm.roomNo || !roomForm.name" @click="saveRoom">
          保存病房
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useMonitoringStore } from "../store";

const store = useMonitoringStore();
const selectedWardId = ref(store.wards[0]?.id ?? "");
const wardEditorVisible = ref(false);
const roomEditorVisible = ref(false);
const editingWardId = ref("");
const editingRoomId = ref("");
const wardForm = reactive({ code: "", name: "" });
const roomForm = reactive({ roomNo: "", name: "" });

const selectedWard = computed(() => store.wards.find((ward) => ward.id === selectedWardId.value));
const selectedRooms = computed(() =>
  store.rooms
    .filter((room) => room.wardId === selectedWardId.value)
    .sort((left, right) => left.roomNo.localeCompare(right.roomNo)),
);

function roomCount(wardId: string): number {
  return store.rooms.filter((room) => room.wardId === wardId).length;
}

function bedCount(roomId: string): number {
  return store.beds.filter((bed) => bed.roomId === roomId).length;
}

function openWardEditor(wardId?: string): void {
  editingWardId.value = wardId ?? "";
  const ward = wardId ? store.wards.find((item) => item.id === wardId) : null;
  wardForm.code = ward?.code ?? "";
  wardForm.name = ward?.name ?? "";
  wardEditorVisible.value = true;
}

function openRoomEditor(roomId?: string): void {
  editingRoomId.value = roomId ?? "";
  const room = roomId ? store.rooms.find((item) => item.id === roomId) : null;
  roomForm.roomNo = room?.roomNo ?? "";
  roomForm.name = room?.name ?? "";
  roomEditorVisible.value = true;
}

function saveWard(): void {
  try {
    if (editingWardId.value) {
      store.updateWard(editingWardId.value, wardForm);
    } else {
      selectedWardId.value = store.addWard(wardForm);
    }
    wardEditorVisible.value = false;
    ElMessage.success("病区已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "病区保存失败");
  }
}

function saveRoom(): void {
  try {
    if (editingRoomId.value) {
      store.updateRoom(editingRoomId.value, roomForm);
    } else {
      store.addRoom({
        wardId: selectedWardId.value,
        roomNo: roomForm.roomNo,
        name: roomForm.name,
      });
    }
    roomEditorVisible.value = false;
    ElMessage.success("病房已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "病房保存失败");
  }
}

async function confirmDeleteRoom(roomId: string): Promise<void> {
  const room = store.rooms.find((item) => item.id === roomId);
  if (!room) return;
  try {
    await ElMessageBox.confirm(
      `确定删除“${room.name}”吗？只有没有床位的病房可以删除。`,
      "删除病房",
      {
        confirmButtonText: "删除病房",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    store.deleteRoom(roomId);
    ElMessage.success("病房已删除");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "病房删除失败");
  }
}

async function confirmDeleteWard(wardId: string): Promise<void> {
  const ward = store.wards.find((item) => item.id === wardId);
  if (!ward) return;
  try {
    await ElMessageBox.confirm(
      `确定删除病区“${ward.name}”吗？只有没有病房和床位的病区可以删除。`,
      "删除病区",
      {
        confirmButtonText: "删除病区",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    store.deleteWard(wardId);
    selectedWardId.value = store.wards[0]?.id ?? "";
    ElMessage.success("病区已删除");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "病区删除失败");
  }
}
</script>

<style scoped lang="scss">
.organization-page {
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

.organization-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  margin-top: 18px;
}

.ward-panel,
.room-panel {
  padding: 16px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > header {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px solid #e4ebe8;

    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 650;
    }

    span {
      font-size: 10px;
      color: #7d8e89;
    }
  }
}

.ward-item {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 13px 12px;
  margin-top: 7px;
  color: #49665f;
  text-align: left;
  cursor: pointer;
  background: #f8fbfa;
  border: 1px solid #e1e9e6;

  &.is-active {
    background: #ebf5f1;
    border-color: #7eae9f;
  }

  div {
    display: grid;
    gap: 3px;
  }

  small,
  span {
    font-size: 9px;
    color: #7b8d87;
  }

  strong {
    font-size: 12px;
    font-weight: 650;
    color: #234f46;
  }
}

.room-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.room-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.room-card {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: #fbfcfb;
  border: 1px solid #e3ebe8;
}

.room-card__actions {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
}

.room-card__number {
  padding: 9px 6px;
  font-family: "Avenir Next", sans-serif;
  font-size: 16px;
  font-weight: 650;
  color: #28695b;
  text-align: center;
  background: #eaf4f0;
  border-radius: 2px;
}

.room-card__body {
  display: grid;
  gap: 4px;

  strong {
    font-size: 12px;
  }

  span {
    font-size: 9px;
    color: #7f8f8a;
  }
}

@media (width <= 900px) {
  .organization-grid {
    grid-template-columns: 1fr;
  }
}

@media (width <= 600px) {
  .admin-page-header,
  .room-panel > header {
    flex-direction: column;
    align-items: flex-start;
  }

  .room-card {
    grid-template-columns: 54px minmax(0, 1fr);
  }

  .room-card > .room-card__actions {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
