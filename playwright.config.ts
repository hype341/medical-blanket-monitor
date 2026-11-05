import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "ui-monitoring.spec.ts",
  fullyParallel: false,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
});
