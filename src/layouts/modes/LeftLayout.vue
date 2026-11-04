<template>
  <BaseLayout>
    <div
      v-show="!appStore.contentFullscreen"
      class="layout-sidebar"
      :class="{ 'is-collapsed': !isSidebarOpen }"
    >
      <div :class="{ 'has-logo': showLogo }" class="layout-sidebar__inner">
        <LayoutLogo v-if="showLogo" :collapse="!isSidebarOpen" />
        <div v-if="isSidebarOpen" class="layout-sidebar__section">
          <span>功能列表</span>
          <small>{{ routes.length }} 个模块</small>
        </div>
        <el-scrollbar>
          <LayoutSidebar :data="routes" base-path="" />
        </el-scrollbar>
      </div>
    </div>

    <div
      class="layout-main"
      :class="{
        'is-collapsed': !isSidebarOpen,
        'is-fullscreen': appStore.contentFullscreen,
      }"
    >
      <LayoutNavbar v-show="!appStore.contentFullscreen" />
      <LayoutTagsView v-if="showTagsView" />
      <LayoutMain />
    </div>
  </BaseLayout>
</template>

<script setup lang="ts">
import { useLayout } from "../composables/useLayout";
import { useAppStore } from "@/stores";
import BaseLayout from "../BaseLayout.vue";
import LayoutLogo from "../components/LayoutLogo.vue";
import LayoutNavbar from "../components/LayoutNavbar.vue";
import LayoutTagsView from "../components/LayoutTagsView.vue";
import LayoutMain from "../components/LayoutMain.vue";
import LayoutSidebar from "../components/LayoutSidebar.vue";

const { showTagsView, showLogo, isSidebarOpen, routes } = useLayout();
const appStore = useAppStore();
</script>

<style lang="scss" scoped>
@use "@/styles/mixins" as *;

.layout-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 999;
  width: $sidebar-width;
  background-color: $menu-background;
  transition: width 0.28s;

  &.is-collapsed {
    width: $sidebar-width-collapsed;
  }

  &__inner {
    position: relative;
    height: 100%;
    background-color: var(--menu-background);
    border-right: 1px solid var(--card-border);
    transition: width 0.28s;

    &.has-logo {
      .el-scrollbar {
        height: calc(100vh - $navbar-height - 42px);
      }
    }

    :deep(.el-menu) {
      border: none;
    }
  }

  &__section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 42px;
    padding: 0 16px;
    color: var(--menu-text);

    span {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
    }

    small {
      font-size: 9px;
      color: color-mix(in srgb, var(--menu-text) 62%, transparent);
    }
  }
}

.layout-main {
  position: relative;
  height: 100%;
  margin-left: $sidebar-width;
  overflow-y: auto;
  transition: margin-left 0.28s;

  &.is-collapsed {
    margin-left: $sidebar-width-collapsed;
  }

  &.is-fullscreen {
    margin-left: 0 !important;
  }
}

.is-mobile {
  .layout-sidebar {
    width: $sidebar-width !important;
    transition:
      transform 0.28s,
      width 0s;
  }

  &.is-sidebar-collapsed {
    .layout-sidebar {
      transform: translateX(-$sidebar-width);
    }
  }

  &.is-sidebar-open {
    .layout-sidebar {
      transform: translateX(0);
    }
  }

  .layout-main {
    margin-left: 0 !important;
  }
}
</style>
