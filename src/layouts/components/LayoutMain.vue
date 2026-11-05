<template>
  <section class="layout-content" :style="{ height: appMainHeight }">
    <router-view>
      <template #default="{ Component, route }">
        <keep-alive :include="cachedViews">
          <component :is="currentComponent(Component, route)" :key="route.fullPath" />
        </keep-alive>
      </template>
    </router-view>

    <el-backtop target=".layout-content">
      <div class="i-svg:backtop w-6 h-6" />
    </el-backtop>
  </section>
</template>

<script setup lang="ts">
import type { RouteLocationNormalized } from "vue-router";
import { useSettingsStore, useTagsViewStore } from "@/stores";
import variables from "@/styles/variables.module.scss";
import Error404 from "@/views/internal/error/404.vue";

const { cachedViews } = toRefs(useTagsViewStore());

const settingsStore = useSettingsStore();

const wrapperMap = new Map<string, Component>();
/**
 * 解析当前路由要渲染的组件
 */
const currentComponent = (component: Component, route: RouteLocationNormalized) => {
  if (!component) return;

  const { fullPath: componentName } = route;
  let wrapper = wrapperMap.get(componentName);

  if (!wrapper) {
    wrapper = {
      name: componentName,
      render: () => {
        try {
          return h(component);
        } catch (error) {
          console.error(`Error rendering component for route: ${componentName}`, error);
          return h(Error404);
        }
      },
    };
    wrapperMap.set(componentName, wrapper);
  }

  if (wrapperMap.size > 100) {
    const firstKey = wrapperMap.keys().next().value;
    if (firstKey) {
      wrapperMap.delete(firstKey);
    }
  }

  return h(wrapper);
};

const appMainHeight = computed(() => {
  if (settingsStore.showTagsView) {
    return `calc(100vh - ${variables["navbar-height"]} - ${variables["tags-view-height"]})`;
  } else {
    return `calc(100vh - ${variables["navbar-height"]})`;
  }
});

</script>

<style lang="scss" scoped>
.layout-content {
  position: relative;
  overflow-y: auto;
  background-color: var(--page-bg);
  background-image: var(--page-bg-image);
  background-attachment: fixed;
}
</style>
