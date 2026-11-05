<template>
  <el-dialog
    v-model="visible"
    :title="cameraId ? '编辑摄像头' : '新增摄像头'"
    width="520px"
    destroy-on-close
  >
    <el-form label-position="top">
      <el-form-item label="摄像头名称">
        <el-input
          v-model.trim="form.name"
          aria-label="摄像头名称"
          maxlength="40"
          placeholder="例如：302 病房摄像头"
        />
      </el-form-item>
      <el-form-item label="对应床位">
        <el-select
          v-model="form.bedId"
          aria-label="摄像头对应床位"
          class="camera-location-select w-full"
          placeholder="选择病区、病房和床位"
        >
          <el-option
            v-for="option in bedOptions"
            :key="option.id"
            :label="option.label"
            :value="option.id"
          />
        </el-select>
      </el-form-item>
      <p class="camera-directory-note">
        这里只维护名称和床位对应关系。视频地址、协议和播放线路仅开发者可见。
      </p>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!form.name.trim() || !form.bedId" @click="save">
        保存摄像头
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useMonitoringStore } from "../store";
import type { Camera, ManagedCameraInput } from "../types";

const props = defineProps<{
  modelValue: boolean;
  camera: Camera | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [input: ManagedCameraInput, cameraId: string | null];
}>();

const store = useMonitoringStore();
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});
const cameraId = computed(() => props.camera?.id ?? null);
const form = reactive<ManagedCameraInput>({
  name: "",
  bedId: "",
});
const bedOptions = computed(() =>
  store.beds
    .map((bed) => {
      const ward = store.wards.find((item) => item.id === bed.wardId);
      const room = store.rooms.find((item) => item.id === bed.roomId);
      return {
        id: bed.id,
        label: `${ward?.name ?? "未分病区"} / ${room?.name ?? "未分病房"} / ${bed.bedNo} 床`,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label)),
);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const binding = props.camera
      ? store.bindings.find(
          (item) =>
            item.cameraId === props.camera?.id &&
            item.role === "PRIMARY_CAMERA" &&
            item.status === "ACTIVE",
        )
      : undefined;
    form.name = props.camera?.name ?? "";
    form.bedId = binding?.bedId ?? bedOptions.value[0]?.id ?? "";
  },
);

function save(): void {
  emit("save", { ...form }, cameraId.value);
}
</script>

<style scoped lang="scss">
.camera-directory-note {
  margin: 0;
  font-size: 10px;
  line-height: 1.6;
  color: #7e8f89;
}
</style>
