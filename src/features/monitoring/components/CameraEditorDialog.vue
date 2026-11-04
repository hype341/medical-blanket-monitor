<template>
  <el-dialog
    v-model="visible"
    :title="cameraId ? '编辑摄像头' : '新增摄像头'"
    width="520px"
    destroy-on-close
  >
    <el-form label-position="top">
      <el-form-item label="摄像头名称">
        <el-input v-model.trim="form.name" placeholder="摄像头名称" maxlength="40" />
      </el-form-item>
      <el-form-item label="设备标识">
        <el-input v-model.trim="form.cameraKey" placeholder="设备标识" maxlength="60" />
      </el-form-item>
      <div class="camera-editor__row">
        <el-form-item label="厂商（可选）">
          <el-input v-model.trim="form.vendor" placeholder="厂商" maxlength="40" />
        </el-form-item>
        <el-form-item label="型号（可选）">
          <el-input v-model.trim="form.model" placeholder="型号" maxlength="40" />
        </el-form-item>
      </div>
      <div class="camera-editor__protocol">
        <span>接入协议</span>
        <strong>RTSP / RTMP / SRT</strong>
        <small>资源地址和凭证由后端保存，不在浏览器展示。</small>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!form.name || !form.cameraKey" @click="save">
        保存摄像头
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { Camera, CameraInput } from "../types";

const props = defineProps<{
  modelValue: boolean;
  camera: Camera | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [input: CameraInput, cameraId: string | null];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

const cameraId = computed(() => props.camera?.id ?? null);
const form = reactive<CameraInput>({
  cameraKey: "",
  name: "",
  vendor: "",
  model: "",
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    Object.assign(form, {
      cameraKey: props.camera?.cameraKey ?? "",
      name: props.camera?.name ?? "",
      vendor: props.camera?.vendor ?? "",
      model: props.camera?.model ?? "",
    });
  },
);

function save(): void {
  emit("save", { ...form }, cameraId.value);
}
</script>

<style scoped lang="scss">
.camera-editor__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.camera-editor__protocol {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px 10px;
  padding: 12px;
  background: #f3f8f6;
  border-left: 3px solid #2f806a;

  span,
  small {
    font-size: 10px;
    color: #71837d;
  }

  strong {
    font-size: 11px;
    color: #2f6458;
  }

  small {
    grid-column: 1 / -1;
  }
}

@media (width <= 560px) {
  .camera-editor__row {
    grid-template-columns: 1fr;
  }
}
</style>
