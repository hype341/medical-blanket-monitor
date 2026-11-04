<template>
  <el-dialog
    :model-value="modelValue"
    title="新增床位"
    width="500px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
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
      <el-form-item label="床位号">
        <el-input v-model.trim="bedNo" placeholder="床位号" maxlength="10" />
      </el-form-item>
      <el-form-item label="患者姓名">
        <el-input v-model.trim="patientName" placeholder="患者姓名（可选）" maxlength="30" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!bedNo.trim() || !roomId" @click="save">
        保存床位
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AddBedInput, Room, Ward } from "../types";

const props = defineProps<{
  modelValue: boolean;
  wards: Ward[];
  rooms: Room[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [input: AddBedInput];
}>();

const wardId = ref(props.wards[0]?.id ?? "");
const roomId = ref("");
const bedNo = ref("");
const patientName = ref("");

const availableRooms = computed(() => props.rooms.filter((room) => room.wardId === wardId.value));

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return;
    wardId.value = props.wards[0]?.id ?? "";
    roomId.value = availableRooms.value[0]?.id ?? "";
    bedNo.value = "";
    patientName.value = "";
  },
);

watch(availableRooms, (rooms) => {
  if (!rooms.some((room) => room.id === roomId.value)) {
    roomId.value = rooms[0]?.id ?? "";
  }
});

function save(): void {
  if (!wardId.value || !roomId.value || !bedNo.value.trim()) return;
  emit("save", {
    wardId: wardId.value,
    roomId: roomId.value,
    bedNo: bedNo.value,
    patientName: patientName.value,
  });
}
</script>
