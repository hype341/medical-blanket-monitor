import type { MonitoringRole, PermissionModule } from "./types";

export const moduleOptions: Array<{ value: PermissionModule; label: string }> = [
  { value: "overview", label: "安全总览" },
  { value: "beds", label: "床位监护" },
  { value: "blankets", label: "毯子管理" },
  { value: "bindings", label: "设备绑定" },
  { value: "organization", label: "病区与病房" },
  { value: "staff", label: "人员权限" },
  { value: "policy", label: "告警与录像策略" },
  { value: "video", label: "视频管理" },
  { value: "mqtt", label: "MQTT 管理" },
  { value: "maintenance", label: "维护中心" },
  { value: "developer", label: "开发者概览" },
];

const roleDefaults: Record<MonitoringRole, PermissionModule[]> = {
  NURSE: ["overview", "beds", "bindings"],
  HEAD_NURSE: ["overview", "beds", "bindings"],
  ADMIN: [
    "overview",
    "beds",
    "blankets",
    "bindings",
    "organization",
    "staff",
    "policy",
    "video",
  ],
  DEVELOPER: moduleOptions.map((option) => option.value),
};

export const roleRank: Record<MonitoringRole, number> = {
  NURSE: 10,
  HEAD_NURSE: 20,
  ADMIN: 30,
  DEVELOPER: 40,
};

export function defaultModulesForRole(role: MonitoringRole): PermissionModule[] {
  return [...roleDefaults[role]];
}

export function canManageRole(actor: MonitoringRole, target: MonitoringRole): boolean {
  return roleRank[actor] > roleRank[target];
}
