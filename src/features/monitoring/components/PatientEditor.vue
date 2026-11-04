<template>
  <el-dialog
    :model-value="modelValue"
    title="编辑患者信息"
    width="520px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="patient-editor__bed">
      <span>{{ roomName }}</span>
      <strong>{{ bedName }}</strong>
    </div>

    <el-form label-position="top" class="patient-editor__form">
      <div v-if="canEditLocation" class="patient-editor__row">
        <el-form-item label="所属病区">
          <el-select v-model="wardId" class="w-full">
            <el-option v-for="ward in wards" :key="ward.id" :label="ward.name" :value="ward.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属病房">
          <el-select v-model="roomId" class="w-full">
            <el-option
              v-for="room in availableRooms"
              :key="room.id"
              :label="room.name"
              :value="room.id"
            />
          </el-select>
        </el-form-item>
      </div>

      <el-form-item v-if="canEditLocation" label="床位号">
        <el-input v-model.trim="bedNo" placeholder="床位号" maxlength="10" />
      </el-form-item>

      <div class="patient-editor__row">
        <el-form-item label="患者姓名">
          <el-input v-model.trim="patientName" placeholder="患者姓名" maxlength="30" />
        </el-form-item>
        <el-form-item label="住院号">
          <el-input v-model.trim="patientNo" placeholder="住院号" maxlength="40" />
        </el-form-item>
      </div>

      <el-form-item label="患者状态">
        <el-radio-group v-model="patientStatus">
          <el-radio-button value="STABLE">平稳</el-radio-button>
          <el-radio-button value="OBSERVATION">观察中</el-radio-button>
          <el-radio-button value="CRITICAL">重点关注</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="床位状态">
        <el-radio-group v-model="bedStatus">
          <el-radio-button value="OCCUPIED">住院中</el-radio-button>
          <el-radio-button value="AVAILABLE">空床</el-radio-button>
          <el-radio-button value="CLEANING">清洁中</el-radio-button>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!patientName.trim()" @click="save">
        保存患者信息
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Bed, BedStatus, PatientStatus, PatientUpdateInput, Room, Ward } from "../types";

const props = defineProps<{
  modelValue: boolean;
  bed: Bed | null;
  roomName: string;
  wards: Ward[];
  rooms: Room[];
  canEditLocation: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [input: PatientUpdateInput];
}>();

const patientName = ref("");
const patientNo = ref("");
const patientStatus = ref<PatientStatus>("STABLE");
const bedStatus = ref<BedStatus>("OCCUPIED");
const wardId = ref("");
const roomId = ref("");
const bedNo = ref("");

const bedName = `${props.bed?.bedNo ?? ""} 床`;
const availableRooms = computed(() => props.rooms.filter((room) => room.wardId === wardId.value));

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible || !props.bed) return;
    patientName.value = props.bed.patientName ?? "";
    patientNo.value = props.bed.patientNo ?? "";
    patientStatus.value = props.bed.patientStatus ?? "STABLE";
    bedStatus.value = props.bed.status;
    wardId.value = props.bed.wardId;
    roomId.value = props.bed.roomId;
    bedNo.value = props.bed.bedNo;
  },
);

watch(availableRooms, (rooms) => {
  if (!rooms.some((room) => room.id === roomId.value)) {
    roomId.value = rooms[0]?.id ?? "";
  }
});

function save(): void {
  if (!patientName.value.trim()) return;
  emit("save", {
    patientName: patientName.value,
    patientNo: patientNo.value,
    patientStatus: patientStatus.value,
    bedStatus: bedStatus.value,
    ...(props.canEditLocation
      ? {
          wardId: wardId.value,
          roomId: roomId.value,
          bedNo: bedNo.value,
        }
      : {}),
  });
}
</script>

<style scoped lang="scss">
.patient-editor__bed {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 12px 14px;
  background: #f0f6f3;
  border-left: 4px solid #2f806a;

  span {
    font-size: 11px;
    color: #6e827c;
  }

  strong {
    font-size: 15px;
    color: #173c3a;
  }
}

.patient-editor__form {
  margin-top: 20px;
}

.patient-editor__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (width <= 560px) {
  .patient-editor__row {
    grid-template-columns: 1fr;
  }
}
</style>
