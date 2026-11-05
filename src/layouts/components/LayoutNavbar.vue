<template>
  <div class="layout-navbar">
    <div class="flex-y-center">
      <Hamburger
        :is-active="sidebarState.opened"
        label="列表"
        @toggle-click="sidebarState.toggle"
      />
      <div class="layout-navbar__status" aria-label="床位状态汇总">
        <span
          v-if="monitoringStore.openAlarmCount"
          class="navbar-alert-badge"
          :title="`${monitoringStore.openAlarmCount} 条未处理告警`"
          :aria-label="`${monitoringStore.openAlarmCount} 条未处理告警`"
        >
          {{ monitoringStore.openAlarmCount }}
        </span>
        <span
          v-if="monitoringStore.unboundBedCount"
          class="navbar-unbound-badge"
          :title="`${monitoringStore.unboundBedCount} 张床位待补设备绑定`"
          :aria-label="`${monitoringStore.unboundBedCount} 张床位待补设备绑定`"
        >
          {{ monitoringStore.unboundBedCount }}
        </span>
      </div>
      <Breadcrumb />
    </div>

    <div class="layout-navbar__actions">
      <LayoutToolbar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/stores";
import { useMonitoringStore } from "@/features/monitoring/store";

/**
 * 顶部导航栏
 */
const props = withDefaults(
  defineProps<{
    toggleTarget?: "primary" | "secondary";
  }>(),
  {
    toggleTarget: "primary",
  },
);

const appStore = useAppStore();
const monitoringStore = useMonitoringStore();

const sidebarState = computed(() =>
  props.toggleTarget === "secondary"
    ? {
        opened: appStore.secondarySidebar?.opened ?? true,
        toggle: () => appStore.toggleSecondarySidebar(),
      }
    : { opened: appStore.sidebar.opened, toggle: () => appStore.toggleSidebar() },
);
</script>

<style lang="scss" scoped>
.layout-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: $navbar-height;
  padding: 0 14px 0 6px;
  background-color: var(--content-bg);
  border-bottom: 1px solid var(--card-border);
  box-shadow: 0 1px 0 rgb(15 23 42 / 3%);

  &__actions {
    display: flex;
    align-items: center;
    height: 100%;
  }

  &__status {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-right: 8px;
  }
}

.navbar-alert-badge,
.navbar-unbound-badge {
  display: inline-grid;
  place-items: center;
  min-width: 19px;
  height: 19px;
  padding: 0 6px;
  font-family: "Avenir Next", "Noto Sans SC", sans-serif;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  border-radius: 10px;
}

.navbar-alert-badge {
  color: #fff;
  background: #c7463b;
  box-shadow: 0 0 0 3px rgb(199 70 59 / 10%);
}

.navbar-unbound-badge {
  color: #76571d;
  background: #fff1cf;
  border: 1px solid #e5c068;
}
</style>
