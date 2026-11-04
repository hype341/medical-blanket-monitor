<template>
  <div class="policy-page">
    <header class="admin-page-header">
      <div>
        <span>{{ store.hospital.name }} · 管理中心</span>
        <h1>告警与录像策略</h1>
        <p>配置告警触发后的视频保存区间和服务器滚动保留时长。</p>
      </div>
      <el-button type="primary" @click="save">保存策略</el-button>
    </header>

    <div class="policy-grid">
      <section class="policy-card">
        <span>告警片段</span>
        <h2>事件前后保存</h2>
        <div class="policy-card__fields">
          <label>
            <span>告警前</span>
            <el-input-number v-model="form.clipBeforeSeconds" :min="1" :max="300" />
            <small>秒</small>
          </label>
          <label>
            <span>告警后</span>
            <el-input-number v-model="form.clipAfterSeconds" :min="1" :max="600" />
            <small>秒</small>
          </label>
        </div>
        <p>MQTT 告警到达后，自动生成包含事件发生时刻的独立视频片段。</p>
      </section>

      <section class="policy-card">
        <span>滚动录像</span>
        <h2>服务器保留时长</h2>
        <div class="policy-card__retention">
          <el-input-number v-model="form.recordingRetentionMinutes" :min="1" :max="1440" />
          <strong>分钟</strong>
        </div>
        <p>超过保留期的录像从时间轴和后端查询结果中消失，已单独保存的告警片段不受影响。</p>
      </section>

      <section class="policy-card policy-card--full">
        <span>状态规则</span>
        <h2>警告颜色与解决状态</h2>
        <div class="policy-preview">
          <article class="policy-preview__open">
            <strong>报警中</strong>
            <p>未解决或已确认的警告统一红色显示。</p>
          </article>
          <article class="policy-preview__resolved">
            <strong>已解决</strong>
            <p>护士标记解决后显示绿色，并保留解决时间。</p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { ElMessage } from "element-plus";
import { useMonitoringStore } from "../store";
import type { MonitoringPolicy } from "../types";

const store = useMonitoringStore();
const form = reactive<MonitoringPolicy>({ ...store.monitoringPolicy });

function save(): void {
  try {
    store.updateMonitoringPolicy(form);
    Object.assign(form, store.monitoringPolicy);
    ElMessage.success("告警与录像策略已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "策略保存失败");
  }
}
</script>

<style scoped lang="scss">
.policy-page {
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

.policy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.policy-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #dbe6e2;

  > span {
    font-size: 10px;
    font-weight: 650;
    color: #4f766c;
  }

  h2 {
    margin: 6px 0 16px;
    font-size: 17px;
    font-weight: 650;
  }

  p {
    margin: 14px 0 0;
    font-size: 10px;
    line-height: 1.7;
    color: #7d8e89;
  }
}

.policy-card__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  label {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
  }

  span,
  small {
    font-size: 10px;
    color: #71847e;
  }
}

.policy-card__retention {
  display: flex;
  gap: 10px;
  align-items: center;

  strong {
    font-size: 12px;
    color: #637a73;
  }
}

.policy-card--full {
  grid-column: 1 / -1;
}

.policy-preview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  article {
    padding: 14px;
    border-left: 4px solid;
  }

  strong {
    font-size: 12px;
  }

  p {
    margin-top: 5px;
  }
}

.policy-preview__open {
  background: #fff2f0;
  border-color: #c84a3f;
}

.policy-preview__resolved {
  background: #eff8f3;
  border-color: #2f806a;
}

@media (width <= 760px) {
  .admin-page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .policy-grid {
    grid-template-columns: 1fr;
  }

  .policy-card--full {
    grid-column: auto;
  }

  .policy-preview {
    grid-template-columns: 1fr;
  }
}
</style>
