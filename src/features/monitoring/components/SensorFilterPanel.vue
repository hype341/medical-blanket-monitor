<template>
  <section class="sensor-filter-panel" aria-label="数据滤波调参">
    <header>
      <div>
        <span>开发者调参</span>
        <h3>数据滤波调参</h3>
        <p>只处理热力图显示结果，原始 MQTT 字节保持不变。</p>
      </div>
      <button type="button" @click="reset">恢复默认</button>
    </header>

    <div class="sensor-filter-panel__table" role="table" aria-label="滤波参数列表">
      <div class="sensor-filter-panel__head" role="row">
        <span role="columnheader">处理项</span>
        <span role="columnheader">当前值</span>
        <span role="columnheader">调整</span>
      </div>
      <div class="sensor-filter-panel__row" role="row">
        <span role="cell">滤波方式</span>
        <strong role="cell">{{ filterLabel }}</strong>
        <el-select
          :model-value="modelValue.type"
          aria-label="滤波方式"
          @update:model-value="setType"
        >
          <el-option label="不滤波" value="NONE" />
          <el-option label="均值滤波" value="MEAN" />
          <el-option label="中值滤波" value="MEDIAN" />
          <el-option label="高斯滤波" value="GAUSSIAN" />
        </el-select>
      </div>
      <div class="sensor-filter-panel__row" role="row">
        <span role="cell">丢弃阈值</span>
        <strong role="cell">&lt; {{ modelValue.threshold }}</strong>
        <el-input-number
          :model-value="modelValue.threshold"
          aria-label="丢弃阈值"
          :min="0"
          :max="255"
          :step="1"
          controls-position="right"
          @update:model-value="setThreshold"
        />
      </div>
      <div class="sensor-filter-panel__row" role="row">
        <span role="cell">窗口大小</span>
        <strong role="cell">{{ modelValue.windowSize }} × {{ modelValue.windowSize }}</strong>
        <el-select
          :model-value="modelValue.windowSize"
          aria-label="滤波窗口大小"
          :disabled="modelValue.type === 'NONE'"
          @update:model-value="setWindow"
        >
          <el-option label="3 × 3" :value="3" />
          <el-option label="5 × 5" :value="5" />
          <el-option label="7 × 7" :value="7" />
        </el-select>
      </div>
      <div class="sensor-filter-panel__row" role="row">
        <span role="cell">实时平均值</span>
        <strong role="cell">
          {{ formatMean(result.rawMean) }} → {{ formatMean(result.filteredMean) }}
        </strong>
        <small role="cell">原始 → 处理后</small>
      </div>
      <div class="sensor-filter-panel__row" role="row">
        <span role="cell">有效点</span>
        <strong role="cell">{{ result.activePoints }}</strong>
        <small role="cell">已丢弃 {{ result.droppedPoints }} 点</small>
      </div>
      <div class="sensor-filter-panel__row" role="row">
        <span role="cell">当前峰值</span>
        <strong role="cell">{{ result.peakValue }}</strong>
        <small role="cell">原始 0–255</small>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type {
  SensorFilterConfig,
  SensorFilterResult,
  SensorFilterType,
} from "../sensor-filter";

const props = defineProps<{
  modelValue: SensorFilterConfig;
  result: SensorFilterResult;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SensorFilterConfig];
}>();

const filterLabels: Record<SensorFilterType, string> = {
  NONE: "不滤波",
  MEAN: "均值滤波",
  MEDIAN: "中值滤波",
  GAUSSIAN: "高斯滤波",
};

const filterLabel = computed(() => filterLabels[props.modelValue.type]);

function setType(value: SensorFilterType): void {
  emit("update:modelValue", { ...props.modelValue, type: value });
}

function setThreshold(value: number | undefined): void {
  emit("update:modelValue", {
    ...props.modelValue,
    threshold: Math.min(255, Math.max(0, Number(value) || 0)),
  });
}

function setWindow(value: 3 | 5 | 7): void {
  emit("update:modelValue", { ...props.modelValue, windowSize: value });
}

function reset(): void {
  emit("update:modelValue", {
    type: "NONE",
    threshold: 0,
    windowSize: 3,
  });
}

function formatMean(value: number): string {
  return value.toFixed(1);
}
</script>

<style scoped lang="scss">
.sensor-filter-panel {
  margin-top: 12px;
  overflow: hidden;
  background: #f8fbfa;
  border: 1px solid #d8e7e1;

  > header {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: linear-gradient(120deg, #eef8f3, #f9fcfb);
    border-bottom: 1px solid #dce9e4;

    span,
    p {
      font-size: 9px;
      color: #748a83;
    }

    h3 {
      margin: 3px 0;
      font-size: 14px;
      font-weight: 680;
    }

    p {
      margin: 0;
    }

    button {
      padding: 5px 8px;
      font-size: 9px;
      color: #326b5d;
      cursor: pointer;
      background: #fff;
      border: 1px solid #c9ddd5;
    }
  }
}

.sensor-filter-panel__table {
  display: grid;
}

.sensor-filter-panel__head,
.sensor-filter-panel__row {
  display: grid;
  grid-template-columns: minmax(90px, 0.8fr) minmax(100px, 1fr) minmax(128px, 1.15fr);
  gap: 10px;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid #e8efec;
}

.sensor-filter-panel__head {
  font-size: 8px;
  font-weight: 650;
  color: #80938d;
  text-transform: uppercase;
  background: #f2f7f5;
}

.sensor-filter-panel__row {
  font-size: 10px;

  > span {
    color: #6f857e;
  }

  strong {
    font-family: "Avenir Next", sans-serif;
    font-size: 10px;
    font-weight: 650;
    color: #275f53;
  }

  small {
    font-size: 9px;
    color: #7a8f88;
  }

  :deep(.el-select),
  :deep(.el-input-number) {
    width: 100%;
  }
}

.sensor-filter-panel__row:last-child {
  border-bottom: 0;
}

@container sensor-panel (width <= 480px) {
  .sensor-filter-panel__head {
    display: none;
  }

  .sensor-filter-panel__row {
    grid-template-columns: minmax(80px, 0.8fr) minmax(0, 1.2fr);

    > :last-child {
      grid-column: 2;
    }
  }
}
</style>
