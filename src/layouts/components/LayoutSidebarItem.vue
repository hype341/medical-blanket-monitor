<template>
  <div v-if="!item.meta || !item.meta.hidden">
    <template v-if="leafMenu">
      <AppLink
        v-if="leafMenu.meta"
        :to="{
          path: resolvePath(leafMenu.path),
          meta: leafMenu.meta,
          query: leafMenu.meta.params,
        }"
      >
        <el-menu-item
          :index="resolvePath(leafMenu.path)"
          :class="{ 'submenu-title-noDropdown': !isNest }"
        >
          <template v-if="leafMenu.meta">
            <LayoutMenuIcon :icon="leafMenu.meta.icon || item.meta?.icon" />
            <span
              v-if="leafMenu.meta.title"
              class="ml-1"
              :title="translateRouteTitle(leafMenu.meta.title)"
            >
              {{ translateRouteTitle(leafMenu.meta.title) }}
            </span>
            <span v-if="getBadge(leafMenu.meta)" class="menu-badge">
              {{ getBadge(leafMenu.meta) }}
            </span>
            <template v-if="isBedMonitoring(leafMenu.meta)">
              <span
                v-if="monitoringStore.openAlarmCount"
                class="menu-badge menu-badge--alarm"
                :title="`${monitoringStore.openAlarmCount} 条未处理告警`"
              >
                {{ monitoringStore.openAlarmCount }}
              </span>
              <span
                v-if="monitoringStore.unboundBedCount"
                class="menu-badge menu-badge--unbound"
                :title="`${monitoringStore.unboundBedCount} 张床位待补设备绑定`"
              >
                {{ monitoringStore.unboundBedCount }}
              </span>
            </template>
          </template>
        </el-menu-item>
      </AppLink>
    </template>

    <template v-else-if="!item.meta?.title">
      <LayoutSidebarItem
        v-for="child in item.children"
        :key="child.path"
        :is-nest="true"
        :item="child"
        :base-path="resolvePath(child.path)"
      />
    </template>

    <el-sub-menu v-else :index="resolvePath(item.path)" :data-path="item.path" teleported>
      <template #title>
        <template v-if="item.meta">
          <LayoutMenuIcon :icon="item.meta.icon" />
          <span v-if="item.meta.title" class="ml-1" :title="translateRouteTitle(item.meta.title)">
            {{ translateRouteTitle(item.meta.title) }}
          </span>
          <span v-if="getBadge(item.meta)" class="menu-badge">
            {{ getBadge(item.meta) }}
          </span>
          <template v-if="isBedMonitoring(item.meta)">
            <span
              v-if="monitoringStore.openAlarmCount"
              class="menu-badge menu-badge--alarm"
              :title="`${monitoringStore.openAlarmCount} 条未处理告警`"
            >
              {{ monitoringStore.openAlarmCount }}
            </span>
            <span
              v-if="monitoringStore.unboundBedCount"
              class="menu-badge menu-badge--unbound"
              :title="`${monitoringStore.unboundBedCount} 张床位待补设备绑定`"
            >
              {{ monitoringStore.unboundBedCount }}
            </span>
          </template>
        </template>
      </template>

      <LayoutSidebarItem
        v-for="child in item.children"
        :key="child.path"
        :is-nest="true"
        :item="child"
        :base-path="resolvePath(child.path)"
      />
    </el-sub-menu>
  </div>
</template>

<script setup lang="ts">
import path from "path-browserify";
import type { RouteMeta, RouteRecordRaw } from "vue-router";
import { isExternal } from "@/utils";
import { translateRouteTitle } from "@/lang/utils";
import { useMonitoringStore } from "@/features/monitoring/store";
import LayoutMenuIcon from "./LayoutMenuIcon.vue";

defineOptions({
  name: "LayoutSidebarItem",
  inheritAttrs: false,
});

/**
 * 侧边栏菜单项
 */
const props = defineProps({
  /** 当前路由对象 */
  item: {
    type: Object as PropType<RouteRecordRaw>,
    required: true,
  },

  /** 父级完整路径 */
  basePath: {
    type: String,
    required: true,
  },

  /** 是否为嵌套路由 */
  isNest: {
    type: Boolean,
    default: false,
  },
});
const monitoringStore = useMonitoringStore();

const showingChildren = computed(() =>
  (props.item.children ?? []).filter((route) => !route.meta?.hidden),
);

const leafMenu = computed<RouteRecordRaw | undefined>(() => {
  if (showingChildren.value.length === 0) {
    // 子路径留空，使叶子菜单指向当前父路径。
    return { ...props.item, path: "" };
  }

  // 无标题且只有一个可见子项时，省略空分组。
  return !props.item.meta?.title && showingChildren.value.length === 1
    ? showingChildren.value[0]
    : undefined;
});

/**
 * 解析菜单跳转路径
 */
function resolvePath(routePath: string) {
  if (isExternal(routePath)) return routePath;
  if (isExternal(props.basePath)) return props.basePath;

  return path.resolve(props.basePath, routePath);
}

/**
 * 读取路由参数中的 badge 作为菜单角标，缺失时返回空字符串。
 */
function getBadge(meta: RouteMeta | undefined): string {
  const params = meta?.params as Record<string, unknown> | undefined;
  return params?.badge ? String(params.badge) : "";
}

function isBedMonitoring(meta: RouteMeta | undefined): boolean {
  return meta?.module === "beds";
}
</script>

<style lang="scss" scoped>
.menu-badge {
  height: 16px;
  padding: 0 5px;
  margin-left: 6px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  color: #fff;
  background-color: var(--el-color-danger);
  border-radius: 8px;
}

.menu-badge--unbound {
  color: #76571d;
  background-color: #fff1cf;
  border: 1px solid #e5c068;
}
</style>
