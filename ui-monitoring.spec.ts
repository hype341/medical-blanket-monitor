import { expect, test, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, "admin");
}

async function loginAs(page: Page, username: "admin" | "nurse" | "developer"): Promise<void> {
  await page.goto("/#/overview", { waitUntil: "networkidle" });
  await page.locator('input[placeholder="用户名"]').fill(username);
  await page.locator('input[placeholder="密码"]').fill("123456");
  await page.locator('input[placeholder="验证码"]').fill("1");
  await page.locator(".login-card__submit").click();
  await page.waitForURL("**/#/overview");
}

test("nurse can open a bed monitor from the safety overview", async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.getByRole("heading", { name: "安全总览" })).toBeVisible();
  await page.screenshot({ path: "test-results/monitoring-overview.png", fullPage: true });
  await page.getByText("床位监护", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "床位监护" })).toBeVisible();
  await expect(page.getByText("A 病区 · 外科").first()).toBeVisible();

  await page.locator('[data-testid="bed-card"]').first().click();
  await expect(page).toHaveURL(/#\/beds\/bed-/);
  await expect(page.getByTestId("sensor-graphic")).toBeVisible();
  await expect(page.getByText("毯面温度")).toHaveCount(0);
  await expect(page.getByText("设备电量")).toHaveCount(0);
  const refreshRate = page.getByLabel("传感器图形帧率");
  await refreshRate.fill("7");
  await expect(refreshRate).toHaveValue("7");
  await page.getByRole("button", { name: "5 帧/秒", exact: true }).click();
  await expect(refreshRate).toHaveValue("5");
  await expect(page.getByText("智能识别扩展")).toBeVisible();
  await expect(page.getByText("录像回放").first()).toBeVisible();
  await expect(page.getByText("告警时间线").first()).toBeVisible();
  await expect(page.getByText("暂无录像片段").first()).toBeVisible();
  await expect(page.getByText("暂无告警").first()).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/monitoring-bed-detail.png", fullPage: true });
});

test("video monitor plays the real Jetson camera stream", async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByText("实时监控", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "实时监控" })).toBeVisible();
  await expect(page.locator('[data-testid="video-tile"]')).toHaveCount(1);
  await expect(page.getByText("301 病房摄像头").first()).toBeVisible();
  await expect(page.locator('.universal-player[data-state="playing"]')).toBeVisible({
    timeout: 20_000,
  });
  await page.screenshot({ path: "test-results/live-camera.png", fullPage: true });
});

test("binding page maps one camera to a bed without side-view options", async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByText("设备绑定", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "设备绑定" })).toBeVisible();
  await expect(page.getByText("301 病房").first()).toBeVisible();

  await page.getByRole("button", { name: "编辑绑定" }).first().click();
  await expect(page.getByText("选择毯子传感器", { exact: true })).toBeVisible();
  await expect(page.getByText("选择摄像头", { exact: true })).toBeVisible();
  await expect(page.getByText("侧视角")).toHaveCount(0);

  await page.getByRole("button", { name: "保存绑定" }).click();
  await expect(page.getByText("绑定已保存")).toBeVisible();
  await page.screenshot({ path: "test-results/monitoring-bindings.png", fullPage: true });
});

test("nurse can add and update a patient but cannot manage bindings", async ({ page }) => {
  await loginAs(page, "nurse");

  await page.getByText("床位监护", { exact: true }).first().click();
  await page.getByRole("button", { name: "新增床位" }).click();
  await page.locator('input[placeholder="床位号"]').fill("03");
  await page.locator('input[placeholder="患者姓名（可选）"]').fill("待入院患者");
  await page.getByRole("button", { name: "保存床位" }).click();
  await expect(page.getByText("03 床").first()).toBeVisible();

  await page.locator('[data-testid="bed-card"]').first().click();
  await page.getByRole("button", { name: "编辑患者信息" }).click();
  await page.locator('input[placeholder="患者姓名"]').fill("王小明");
  await page.locator('input[placeholder="住院号"]').fill("ZY20261104003");
  await page.getByText("观察中", { exact: true }).click();
  await page.getByRole("button", { name: "保存患者信息" }).click();
  await expect(page.getByText("患者信息已保存")).toBeVisible();

  await page.getByText("设备绑定", { exact: true }).first().click();
  await expect(page.getByText("仅管理员或开发者可修改设备绑定")).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑绑定" }).first()).toBeDisabled();
  await expect(page.getByText("病区与病房", { exact: true })).toHaveCount(0);
});

test("administrator can edit bed location and overwrite patient content", async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByText("床位监护", { exact: true }).first().click();
  await page.locator('[data-testid="bed-card"]').first().click();
  await page.getByRole("button", { name: "编辑患者信息" }).click();

  await expect(page.getByText("所属病区", { exact: true })).toBeVisible();
  await expect(page.getByText("所属病房", { exact: true })).toBeVisible();
  await page.locator('input[placeholder="床位号"]').fill("08");
  await page.locator('input[placeholder="患者姓名"]').fill("管理员覆盖患者");
  await page.getByRole("button", { name: "保存患者信息" }).click();

  await expect(page.getByText("患者信息已保存")).toBeVisible();
  await expect(page.getByRole("heading", { name: /08 床 · 管理员覆盖患者/ })).toBeVisible();
  await expect(page.getByText("最后修改：管理员")).toBeVisible();
});

test("only administrators can manage wards and rooms", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByText("管理中心", { exact: true }).first().click();
  await page.getByText("病区与病房", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "病区与病房管理" })).toBeVisible();

  await page.getByRole("button", { name: "新增病区" }).click();
  await page.locator('input[placeholder="病区编码"]').fill("WARD-C");
  await page.locator('input[placeholder="病区名称"]').fill("C 病区 · 内科");
  await page.getByRole("button", { name: "保存病区" }).click();
  await expect(page.getByText("C 病区 · 内科").first()).toBeVisible();

  await page.getByText("人员权限", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "人员权限管理" })).toBeVisible();
  await page.getByRole("button", { name: "新增人员" }).click();
  await page.locator('input[placeholder="登录账号"]').fill("nurse-li");
  await page.locator('input[placeholder="人员姓名"]').fill("李护士");
  await page.locator('input[placeholder="登录密码"]').fill("Nurse@123456");
  await page.getByRole("button", { name: "保存人员权限" }).click();
  await expect(page.getByText("李护士").first()).toBeVisible();

  await page.getByText("告警与录像策略", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "告警与录像策略" })).toBeVisible();
  await expect(page.getByText("系统连接", { exact: true })).toHaveCount(0);
});

test("developer can inspect MQTT credentials and runtime diagnostics", async ({ page }) => {
  await loginAs(page, "developer");

  await page.getByText("管理中心", { exact: true }).first().click();
  await page.getByText("系统连接", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "系统连接与 MQTT" })).toBeVisible();
  await expect(page.getByText("EMQX 接入")).toBeVisible();
  await expect(page.getByText("告警主题", { exact: true })).toBeVisible();

  await page.getByText("开发者控制台", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "开发者控制台" })).toBeVisible();
  await expect(page.getByText("MQTT 原始报文")).toBeVisible();
  await expect(page.getByText("接口与密钥")).toBeVisible();

  await page.getByText("摄像头管理", { exact: true }).first().click();
  await page.getByRole("button", { name: "新增摄像头" }).click();
  await page.locator('input[placeholder="摄像头名称"]').fill("201 病房摄像头");
  await page.locator('input[placeholder="设备标识"]').fill("camera-02");
  await page.getByRole("button", { name: "保存摄像头" }).click();
  await expect(page.getByText("201 病房摄像头").first()).toBeVisible();
});
