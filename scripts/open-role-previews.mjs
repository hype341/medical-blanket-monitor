import { chromium } from "@playwright/test";

const baseUrl = process.env.ROLE_PREVIEW_URL ?? "http://127.0.0.1:3000";
const accounts = [
  { username: "admin", label: "医院管理员" },
  { username: "nurse", label: "护士" },
  { username: "head-nurse", label: "护士长" },
  { username: "developer", label: "开发者" },
];

const browser = await chromium.launch({
  headless: false,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--start-maximized"],
});

const contexts = [];

for (const account of accounts) {
  const context = await browser.newContext({ viewport: null });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/#/overview`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="用户名"]').fill(account.username);
  await page.locator('input[placeholder="密码"]').fill("123456");
  await page.locator('input[placeholder="验证码"]').fill("1");
  await page.locator(".login-card__submit").click();
  await page.waitForURL("**/#/overview", { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { name: "安全总览" }).waitFor();
  await page.bringToFront();
  console.log(`opened=${account.label} username=${account.username}`);
}

console.log("role previews are ready; close the browser to stop this process");
await new Promise(() => {});
