<template>
  <div class="management-center">
    <el-tabs v-model="activeTab" class="management-tabs">
      <el-tab-pane label="病区与病房" name="organization">
        <OrganizationView v-if="activeTab === 'organization'" />
      </el-tab-pane>
      <el-tab-pane label="人员权限" name="staff">
        <StaffView v-if="activeTab === 'staff'" />
      </el-tab-pane>
      <el-tab-pane label="告警与录像" name="policy">
        <PolicyView v-if="activeTab === 'policy'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import OrganizationView from "./OrganizationView.vue";
import PolicyView from "./PolicyView.vue";
import StaffView from "./StaffView.vue";

const activeTab = ref("organization");
</script>

<style scoped lang="scss">
.management-center {
  :deep(.el-tabs__header) {
    padding: 0 18px;
    margin-bottom: 0;
    background: #fff;
    border: 1px solid #dbe6e2;
  }

  :deep(.el-tabs__item) {
    height: 46px;
    font-size: 12px;
    font-weight: 600;
  }

  :deep(.el-tabs__content) {
    padding-top: 16px;
  }
}
</style>
