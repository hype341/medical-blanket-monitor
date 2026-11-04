import type { MonitoringRole } from "./types";

export interface DemoAccount {
  username: string;
  label: string;
  role: MonitoringRole;
  wardIds: string[];
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: "admin",
    label: "管理员演示",
    role: "ADMIN",
    wardIds: ["ward-a", "ward-b"],
  },
  {
    username: "nurse",
    label: "护士演示",
    role: "NURSE",
    wardIds: ["ward-a"],
  },
  {
    username: "head-nurse",
    label: "护士长演示",
    role: "HEAD_NURSE",
    wardIds: ["ward-a"],
  },
  {
    username: "developer",
    label: "开发者演示",
    role: "DEVELOPER",
    wardIds: ["ward-a", "ward-b"],
  },
];

export const isDemoLoginEnabled = import.meta.env.VITE_DEMO_LOGIN_ENABLED === "true";

export function matchDemoAccount(username: string, password: string): DemoAccount | null {
  if (password !== "123456") return null;
  return DEMO_ACCOUNTS.find((account) => account.username === username.trim()) ?? null;
}

export function findDemoAccount(username: string, password: string): DemoAccount | null {
  return isDemoLoginEnabled ? matchDemoAccount(username, password) : null;
}
