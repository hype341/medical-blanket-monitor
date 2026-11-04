<template>
  <button
    type="button"
    class="hamburger-wrapper"
    :class="{ 'has-label': label }"
    :aria-label="label ? `${isActive ? '收起' : '展开'}${label}` : undefined"
    :aria-expanded="isActive"
    :title="label ? `${isActive ? '收起' : '展开'}${label}` : undefined"
    @click="toggleClick"
  >
    <div :class="['i-svg:collapse', { hamburger: true, 'is-active': isActive }, hamburgerClass]" />
    <span v-if="label" class="hamburger-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { useSettingsStore } from "@/stores";
import { ThemeMode, SidebarColor, LayoutMode } from "@/enums/settings";

/**
 * 侧边栏折叠按钮
 */
defineProps({
  isActive: { type: Boolean, required: true },
  label: { type: String, default: "" },
});

/**
 * 点击时上抛折叠切换
 */
const emit = defineEmits(["toggleClick"]);

const settingsStore = useSettingsStore();
const layout = computed(() => settingsStore.layout);

const hamburgerClass = computed(() => {
  if (settingsStore.resolvedTheme === ThemeMode.DARK) {
    return "hamburger--white";
  }

  if (
    layout.value === LayoutMode.MIX &&
    settingsStore.sidebarColorScheme === SidebarColor.CLASSIC_BLUE
  ) {
    return "hamburger--white";
  }

  return "";
});

/**
 * 触发侧边栏折叠切换
 */
function toggleClick() {
  emit("toggleClick");
}
</script>

<style scoped lang="scss">
.hamburger-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 100%;
  padding: 0;
  color: var(--el-text-color-regular);
  cursor: pointer;
  background: transparent;
  border: 0;

  &.has-label {
    gap: 5px;
    width: auto;
    padding: 0 8px;
  }

  .hamburger {
    width: 16px;
    height: 16px;
    font-size: 16px;
    vertical-align: middle;
    color: currentcolor;
    background-color: currentcolor;
    transform: scaleX(-1);
    transition:
      color 0.16s,
      transform 0.3s ease;

    &--white {
      color: #fff;
    }

    &.is-active {
      transform: scaleX(1);
    }
  }

  &:hover {
    color: var(--el-color-primary);
  }
}

.hamburger-label {
  font-size: 11px;
  font-weight: 650;
  color: currentcolor;
  white-space: nowrap;
}
</style>
