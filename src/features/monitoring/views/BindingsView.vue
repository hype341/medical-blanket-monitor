<template>
  <div class="bindings-page">
    <header class="bindings-header">
      <div>
        <span>{{ store.hospital.name }} · 床旁设备组</span>
        <h1>设备绑定</h1>
        <p>每张床位将毯子传感器与唯一摄像头组成一个监护设备组。</p>
      </div>
      <span class="bindings-header__summary">{{ rows.length }} 张床位</span>
    </header>

    <section class="binding-note">
      <span class="binding-note__mark">绑定规则</span>
      <p>
        传感器上报标准化设备事件，摄像头提供床旁画面。仅管理员可修改绑定，护士查看当前授权关系。
      </p>
      <strong v-if="!store.canManageBindings">仅管理员或开发者可修改设备绑定</strong>
    </section>

    <div class="binding-table">
      <div class="binding-table__head">
        <span>病房 / 床位</span>
        <span>毯子传感器</span>
        <span>唯一摄像头</span>
        <span>设备组状态</span>
        <span>操作</span>
      </div>
      <div v-for="row in rows" :key="row.bed.id" class="binding-row">
        <div class="binding-row__location">
          <span>{{ row.room?.name ?? "未分房" }}</span>
          <strong>{{ row.bed.bedNo }} 床</strong>
          <small>{{ row.bed.patientName ?? "空床" }}</small>
        </div>
        <div class="binding-row__device">
          <span class="device-glyph device-glyph--sensor">S</span>
          <div>
            <strong>{{ row.sensor?.name ?? "未绑定" }}</strong>
            <small>{{ row.sensor?.deviceKey ?? "请选择毯子传感器" }}</small>
          </div>
        </div>
        <div class="binding-row__device">
          <span class="device-glyph device-glyph--camera">C</span>
          <div>
            <strong>{{ row.camera?.name ?? "未绑定" }}</strong>
            <small>{{ row.camera?.cameraKey ?? "尚未选择摄像头" }}</small>
          </div>
        </div>
        <div>
          <span v-if="row.sensor || row.camera" class="pair-state">
            {{ row.sensor && row.camera ? "已成组" : "待补全" }}
          </span>
          <span v-else class="pair-state pair-state--empty">未绑定</span>
        </div>
        <div>
          <el-button
            size="small"
            plain
            type="primary"
            :disabled="!store.canManageBindings"
            @click="openEditor(row.bed.id)"
          >
            编辑绑定
          </el-button>
        </div>
      </div>
    </div>

    <BindingEditor
      v-model="editorVisible"
      :bed-name="activeRow?.bed ? `${activeRow.bed.bedNo} 床` : ''"
      :room-name="activeRow?.room?.name ?? '未分房'"
      :sensors="store.sensors"
      :cameras="store.cameras"
      :bindings="activeRow?.bindings ?? []"
      @save="saveBinding"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import BindingEditor from "../components/BindingEditor.vue";
import { useMonitoringStore } from "../store";

const store = useMonitoringStore();
const editorVisible = ref(false);
const activeBedId = ref("");

const rows = computed(() =>
  store.bedSummaries.map((summary) => ({
    ...summary,
    camera: summary.cameras[0] ?? null,
    bindings: store.getBedBindings(summary.bed.id),
  })),
);

const activeRow = computed(() => rows.value.find((row) => row.bed.id === activeBedId.value));

function openEditor(bedId: string): void {
  if (!store.canManageBindings) return;
  activeBedId.value = bedId;
  editorVisible.value = true;
}

function saveBinding(payload: { sensorDeviceId: string | null; cameraId: string | null }): void {
  if (!activeBedId.value) return;
  store.updateBinding({
    bedId: activeBedId.value,
    sensorDeviceId: payload.sensorDeviceId,
    cameraId: payload.cameraId,
  });
  editorVisible.value = false;
  ElMessage.success("绑定已保存");
}
</script>

<style scoped lang="scss">
.bindings-page {
  color: #173c3a;
}

.bindings-header {
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

.bindings-header__summary {
  padding: 5px 8px;
  color: #2f6e60 !important;
  background: #eef6f3;
  border: 1px solid #c5dcd5;
}

.binding-note {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 14px 16px;
  margin: 18px 0;
  background: #f8fbfa;
  border: 1px solid #d9e5e1;

  p {
    margin: 0;
    font-size: 12px;
    color: #667a74;
  }
}

.binding-note__mark {
  flex-shrink: 0;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 650;
  color: #fff;
  background: #256b5d;
  border-radius: 2px;
}

.binding-note strong {
  padding: 4px 7px;
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  color: #a43d34;
  white-space: nowrap;
  background: #fff0ee;
  border: 1px solid #e4b2ac;
}

.binding-table {
  overflow-x: auto;
  background: #fff;
  border: 1px solid #dbe6e2;
}

.binding-table__head,
.binding-row {
  display: grid;
  grid-template-columns: minmax(150px, 0.9fr) minmax(200px, 1.2fr) minmax(200px, 1.2fr) 100px 90px;
  gap: 14px;
  align-items: center;
  min-width: 850px;
  padding: 0 16px;
}

.binding-table__head {
  height: 42px;
  font-size: 10px;
  font-weight: 650;
  color: #5f746e;
  background: #edf4f1;
}

.binding-row {
  min-height: 82px;
  border-top: 1px solid #e5ece9;

  > div {
    min-width: 0;
  }
}

.binding-row__location {
  display: grid;
  gap: 3px;

  span,
  small {
    font-size: 10px;
    color: #748680;
  }

  strong {
    font-size: 14px;
    font-weight: 650;
  }
}

.binding-row__device {
  display: flex;
  gap: 10px;
  align-items: center;

  div {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 12px;
    font-weight: 600;
  }

  small {
    font-size: 10px;
    color: #7e8e89;
  }
}

.device-glyph {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  font-family: "Avenir Next", sans-serif;
  font-size: 11px;
  font-weight: 700;
  color: #2c715f;
  background: #eff7f3;
  border: 1px solid #bed8d0;
  border-radius: 3px;
}

.device-glyph--camera {
  color: #3e6877;
  background: #f1f6f8;
  border-color: #c8d7df;
}

.pair-state {
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 600;
  color: #2b6e5b;
  background: #edf7f1;
  border: 1px solid #c2dacf;
}

.pair-state--empty {
  color: #788681;
  background: #f5f7f6;
  border-color: #d9dfdd;
}

@media (width <= 760px) {
  .bindings-header,
  .binding-note {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
