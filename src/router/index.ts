import type { App } from "vue";
import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";
import { ensureFormCreate } from "@/plugins/form-create";

/**
 * 布局组件，供各路由复用（懒加载）
 */
export const Layout = () => import("@/layouts/index.vue");

/**
 * 布局外大屏路由：不套后台 Layout，整页铺满视口，菜单以站内外链形式新标签页打开
 */
export const screenRoutes: RouteRecordRaw[] = [
  {
    path: "/data-screen",
    name: "DataScreen",
    component: () => import("@/views/demo/data-screen/index.vue"),
    meta: { hidden: true, title: "数据大屏" },
  },
];

// 静态路由
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: "/redirect",
    component: Layout,
    meta: { hidden: true },
    children: [
      {
        path: "/redirect/:path(.*)",
        component: () => import("@/views/internal/redirect.vue"),
      },
    ],
  },

  {
    path: "/login",
    component: () => import("@/views/login/index.vue"),
    meta: { hidden: true },
  },

  // 统一认证回调页（匿名访问，守卫白名单，只用票据换取业务令牌）
  {
    path: "/oidc/callback",
    name: "OidcCallback",
    component: () => import("@/views/login/oidc-callback.vue"),
    meta: { hidden: true },
  },

  // 公开表单分享页（匿名访问，守卫白名单，不套管理端 Layout）
  {
    path: "/f/:formKey",
    name: "FormShare",
    component: async () => {
      await ensureFormCreate();
      return import("@/views/dynamic-form/share.vue");
    },
    meta: { hidden: true, title: "表单填写" },
  },

  // 大屏演示页（独立成页，不经后台框架）
  ...screenRoutes,

  {
    path: "/",
    name: "/",
    component: Layout,
    redirect: "/overview",
    children: [
      {
        path: "overview",
        name: "SafetyOverview",
        component: () => import("@/features/monitoring/views/OverviewView.vue"),
        meta: {
          title: "安全总览",
          icon: "homepage",
          affix: true,
          module: "overview",
        },
      },
      {
        path: "beds",
        name: "BedMonitoring",
        component: () => import("@/features/monitoring/views/BedListView.vue"),
        meta: {
          title: "床位监护",
          icon: "table",
          module: "beds",
        },
      },
      {
        path: "beds/:bedId",
        name: "BedMonitoringDetail",
        component: () => import("@/features/monitoring/views/BedDetailView.vue"),
        meta: {
          title: "床位详情",
          icon: "table",
          hidden: true,
          keepAlive: true,
          module: "beds",
        },
      },
      {
        path: "monitor",
        name: "MonitoringVideoWall",
        component: () => import("@/features/monitoring/views/VideoWallView.vue"),
        meta: {
          title: "实时监控",
          icon: "monitor",
          keepAlive: true,
          module: "monitor",
        },
      },
      {
        path: "bindings",
        name: "DeviceBindings",
        component: () => import("@/features/monitoring/views/BindingsView.vue"),
        meta: {
          title: "设备绑定",
          icon: "api",
          module: "bindings",
        },
      },
      {
        path: "devices/cameras",
        name: "CameraManagement",
        component: () => import("@/features/monitoring/views/CameraListView.vue"),
        meta: {
          title: "视频管理",
          icon: "monitor",
          roles: ["DEVELOPER"],
          module: "video",
        },
      },
      {
        path: "admin/wards",
        name: "WardRoomManagement",
        component: () => import("@/features/monitoring/views/OrganizationView.vue"),
        meta: {
          title: "病区与病房",
          icon: "system",
          roles: ["ADMIN", "DEVELOPER"],
          module: "organization",
        },
      },
      {
        path: "admin/staff",
        name: "StaffPermissionManagement",
        component: () => import("@/features/monitoring/views/StaffView.vue"),
        meta: {
          title: "人员权限",
          icon: "role",
          roles: ["ADMIN", "DEVELOPER"],
          module: "staff",
        },
      },
      {
        path: "admin/policy",
        name: "MonitoringPolicyManagement",
        component: () => import("@/features/monitoring/views/PolicyView.vue"),
        meta: {
          title: "告警与录像策略",
          icon: "shield",
          roles: ["ADMIN", "DEVELOPER"],
          module: "policy",
        },
      },
      {
        path: "admin/connections",
        name: "SystemConnectionSettings",
        component: () => import("@/features/monitoring/views/ConnectionSettingsView.vue"),
        meta: {
          title: "MQTT 管理",
          icon: "api",
          roles: ["DEVELOPER"],
          module: "mqtt",
        },
      },
      {
        path: "admin/developer",
        name: "DeveloperConsole",
        component: () => import("@/features/monitoring/views/DeveloperConsoleView.vue"),
        meta: {
          title: "开发者概览",
          icon: "code",
          roles: ["DEVELOPER"],
          module: "developer",
        },
      },
      {
        path: "dashboard",
        component: () => import("@/views/dashboard/index.vue"),
        // 用于 keep-alive 功能，需要与 SFC 中自动推导或显式声明的组件名称一致
        // 参考文档: https://cn.vuejs.org/guide/built-ins/keep-alive.html#include-exclude
        name: "Dashboard",
        meta: {
          title: "dashboard",
          icon: "homepage",
          affix: true,
          keepAlive: true,
          hidden: true,
        },
      },
      {
        path: "401",
        component: () => import("@/views/internal/error/401.vue"),
        meta: { hidden: true },
      },
      {
        path: "404",
        component: () => import("@/views/internal/error/404.vue"),
        meta: { hidden: true },
      },
      {
        path: "profile",
        name: "Profile",
        component: () => import("@/views/workspace/account/index.vue"),
        meta: { title: "个人中心", icon: "user", hidden: true },
      },
      {
        path: "profile/notice",
        name: "MyNotice",
        component: () => import("@/views/workspace/notifications/index.vue"),
        meta: { title: "我的通知", icon: "user", hidden: true },
      },
      {
        path: "/detail/:id(\\d+)",
        name: "DemoDetail",
        component: () => import("@/views/demo/route/detail.vue"),
        meta: { title: "详情页缓存", icon: "user", hidden: true, keepAlive: true },
      },
      {
        path: "/route-example/edit/:id(\\d+)",
        name: "RouteExampleEdit",
        component: () => import("@/views/demo/route/navigate/edit.vue"),
        meta: { title: "跳转编辑页", icon: "user", hidden: true },
      },
    ],
  },
];

/**
 * 创建路由
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: constantRoutes,
  // 刷新时，滚动条位置还原
  scrollBehavior: () => ({ left: 0, top: 0 }),
});

/**
 * 全局注册 router
 */
export function setupRouter(app: App<Element>) {
  app.use(router);
}

export default router;
