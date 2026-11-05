<template>
  <el-dialog
    :model-value="modelValue"
    title="编辑设备绑定"
    width="520px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="binding-editor__bed">
      <span>{{ roomName }}</span>
      <strong>{{ bedName }}</strong>
    </div>

    <el-form label-position="top" class="binding-editor__form">
      <el-form-item label="选择毯子传感器">
        <el-select
          v-model="sensorDeviceId"
          filterable
          placeholder="搜索并选择毯子传感器"
          class="w-full"
        >
          <el-option
            v-for="sensor in sensors"
            :key="sensor.id"
            :label="`${sensor.name} · ${sensor.deviceKey}`"
            :value="sensor.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="选择摄像头">
        <el-select
          v-model="cameraId"
          filterable
          placeholder="搜索并选择摄像头"
          class="w-full"
        >
          <el-option
            v-for="camera in cameras"
            :key="camera.id"
            :label="`${camera.name} · ${camera.cameraKey}`"
            :value="camera.id"
          />
        </el-select>
      </el-form-item>

      <div class="binding-editor__pair">
        <span>毯子传感器</span>
        <strong>+</strong>
        <span>唯一摄像头</span>
        <small>组成一个床旁监护设备组</small>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="save">保存绑定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { Camera, DeviceBinding, SensorDevice } from "../types";

const props = defineProps<{
  modelValue: boolean;
  bedName: string;
  roomName: string;
  sensors: SensorDevice[];
  cameras: Camera[];
  bindings: DeviceBinding[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [payload: { sensorDeviceId: string | null; cameraId: string | null }];
}>();

const sensorDeviceId = ref<string | null>(null);
const cameraId = ref<string | null>(null);

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return;
    sensorDeviceId.value =
      props.bindings.find((binding) => binding.role === "PRIMARY_SENSOR")?.sensorDeviceId ?? null;
    cameraId.value =
      props.bindings.find((binding) => binding.role === "PRIMARY_CAMERA")?.cameraId ?? null;
  },
);

function save(): void {
  emit("save", {
    sensorDeviceId: sensorDeviceId.value,
    cameraId: cameraId.value,
  });
}
</script>

<style scoped lang="scss">
.binding-editor__bed {
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

.binding-editor__form {
  margin-top: 20px;
}

.binding-editor__pair {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: center;
  padding: 16px;
  color: #315e54;
  text-align: center;
  background: #fafcfb;
  border: 1px dashed #bfd5ce;

  strong {
    font-size: 20px;
    font-weight: 400;
    color: #4e8878;
  }

  small {
    grid-column: 1 / -1;
    font-size: 10px;
    color: #7d8f89;
  }
}
</style>
