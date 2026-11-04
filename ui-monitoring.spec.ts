import { expect, test, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, "admin");
}

async function loginAs(
  page: Page,
  username: "admin" | "nurse" | "head-nurse" | "developer",
): Promise<void> {
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
  await expect(page.getByRole("heading", { name: "功能模块" })).toBeVisible();
  await page.screenshot({ path: "test-results/monitoring-overview.png", fullPage: true });
  await page.getByText("床位监护", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "床位监护" })).toBeVisible();
  await expect(page.getByText("A 病区 · 外科").first()).toBeVisible();

  await page.locator('[data-testid="bed-card"]').first().click();
  await expect(page).toHaveURL(/#\/beds\/bed-/);
  await expect(page.getByTestId("sensor-graphic")).toBeVisible();
  await expect(
    page.getByText("medical-blanket/v1/H001/WARD-A/301/alarm", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/medical-blanket\/v1\/H001\/WARD-A\/301-01\/sensor\/blanket-001\/data/),
  ).toBeVisible();
  await expect(page.getByText(/sensor\/.+\/telemetry/)).toHaveCount(0);
  await expect(page.getByText("毯面温度")).toHaveCount(0);
  await expect(page.getByText("设备电量")).toHaveCount(0);
  const refreshRate = page.getByLabel("传感器图形帧率");
  await refreshRate.fill("7");
  await expect(refreshRate).toHaveValue("7");
  await page.getByRole("button", { name: "5 帧/秒", exact: true }).click();
  await expect(refreshRate).toHaveValue("5");
  await expect(page.getByText("智能识别扩展")).toBeVisible();
  await expect(page.getByText("录像回放").first()).toBeVisible();
  await expect(page.getByText("病房告警").first()).toBeVisible();
  const recordingSegment = page.locator(".recording-timeline__segment").first();
  if (await recordingSegment.count()) {
    await expect(page.getByLabel("录像回放进度")).toBeEnabled();
    const startAt = await recordingSegment.getAttribute("data-start-at");
    expect(startAt).toBeTruthy();
    const localTime = await page.evaluate((value: string) => {
      const date = new Date(value);
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
      return local.toISOString().slice(0, 19);
    }, startAt!);
    await page.getByLabel("按时间定位回放").fill(localTime);
    await page.getByRole("button", { name: "回放此时间" }).click();
    await expect(page.locator(".recording-player")).toBeVisible();
    await expect(page.getByText("按时间定位").first()).toBeVisible();
  } else {
    await expect(page.getByText("暂无录像片段").first()).toBeVisible();
  }
  await expect(page.getByText("病房状态平稳").first()).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/monitoring-bed-detail.png", fullPage: true });
});

test("bed monitor stays usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, "nurse");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });

  await expect(page.getByTestId("sensor-graphic")).toBeVisible();
  await expect(page.getByText("病房告警").first()).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/monitoring-bed-mobile.png", fullPage: true });
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
  await expect(page.getByText("值班护士", { exact: true })).toBeVisible();

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
  await page.getByText("管理设置", { exact: true }).first().click();
  await page.getByText("病区与病房", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "病区与病房管理" })).toBeVisible();

  await page.getByRole("button", { name: "新增病区" }).click();
  await page.locator('input[placeholder="病区编码"]').fill("WARD-C");
  await page.locator('input[placeholder="病区名称"]').fill("C 病区 · 内科");
  await page.getByRole("button", { name: "保存病区" }).click();
  await expect(page.getByText("C 病区 · 内科").first()).toBeVisible();

  await page.getByText("人员权限", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "人员权限管理" })).toBeVisible();
  await expect(page.getByText("系统开发者", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "新增人员" }).click();
  await expect(page.getByText("开放模块由开发者配置")).toBeVisible();
  await page.locator('input[placeholder="登录账号"]').fill("nurse-li");
  await page.locator('input[placeholder="人员姓名"]').fill("李护士");
  await page.locator('input[placeholder="登录密码"]').fill("Nurse@123456");
  await page.getByRole("button", { name: "保存人员权限" }).click();
  await expect(page.getByText("李护士").first()).toBeVisible();

  await page.getByText("告警与录像", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "告警与录像策略" })).toBeVisible();
  await expect(page.getByText("系统连接", { exact: true })).toHaveCount(0);
});

test("developer can inspect MQTT credentials and runtime diagnostics", async ({ page }) => {
  await loginAs(page, "developer");
  await expect(page.getByText("系统开发者", { exact: true })).toBeVisible();

  await page.getByText("MQTT 管理", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "系统连接与 MQTT" })).toBeVisible();
  await expect(page.getByText("EMQX 接入")).toBeVisible();
  await expect(page.getByRole("heading", { name: "数据与告警主题" })).toBeVisible();
  await expect(page.getByText("9 个数据主题")).toBeVisible();
  await expect(page.getByText("1 张床位待绑定传感器")).toBeVisible();
  await expect(page.getByText("6 个病房告警主题")).toBeVisible();
  await page.locator(".topic-panel--data").getByRole("button", { name: "复制" }).first().click();
  await expect(page.getByText("床位数据主题已复制")).toBeVisible();
  await page.locator(".topic-panel--alarm").getByRole("button", { name: "复制" }).first().click();
  await expect(page.getByText("病房告警主题已复制")).toBeVisible();
  await expect(
    page.locator(".message-card--data").getByRole("heading", { name: "传感器数据报文" }),
  ).toBeVisible();
  await expect(page.locator(".message-card--data pre")).toContainText('"metrics": {}');
  await expect(page.getByText("MQTT 原始报文")).toBeVisible();
  await expect(page.getByRole("heading", { name: "MQTT 连接文档", exact: true })).toBeVisible();
  await expect(page.locator(".document-panel .document-preview")).toContainText(
    "medical-blanket/v1/H001/WARD-A/301/alarm",
  );
  await expect(page.locator(".document-panel .document-preview")).toContainText(
    "medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data",
  );
  await expect(page.locator(".document-panel .document-preview")).not.toContainText("遥测主题");
  await expect(page.getByRole("button", { name: "导出 PDF" }).first()).toBeVisible();
  await page.waitForTimeout(400);
  await page.locator(".connection-page").screenshot({ path: "test-results/monitoring-mqtt.png" });
  await page
    .locator(".connection-card--alerts")
    .screenshot({ path: "test-results/monitoring-mqtt-topics.png" });
  await page
    .locator(".message-grid")
    .screenshot({ path: "test-results/monitoring-mqtt-messages.png" });

  await page.getByText("开发者概览", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "开发者工作台" })).toBeVisible();
  await expect(page.getByText("两条数据管线，一个运行视图")).toBeVisible();
  await expect(page.getByText("开发者快捷信息")).toBeVisible();

  await page.getByText("进入视频管理", { exact: true }).first().click();
  await page.getByRole("button", { name: "新增摄像头" }).click();
  await page.locator('input[placeholder="摄像头名称"]').fill("201 病房摄像头");
  await page.locator('input[placeholder="设备标识"]').fill("camera-02");
  await page.locator('input[placeholder="媒体路径"]').fill("camera-02");
  await page.getByRole("button", { name: "保存摄像头" }).click();
  await expect(page.getByText("201 病房摄像头").first()).toBeVisible();
  await expect(page.getByText("WebRTC 浏览器观看").first()).toBeVisible();
  await page.locator(".camera-links").first().getByRole("button", { name: "复制" }).first().click();
  await expect(page.getByText("WebRTC 浏览器观看已复制")).toBeVisible();
  await expect(page.getByRole("heading", { name: "视频连接文档", exact: true })).toBeVisible();
  await expect(page.locator(".camera-document .document-preview")).toContainText(
    "http://10.208.236.131:8889/camera-01/whep",
  );
});

test("head nurse only receives the assigned ward", async ({ page }) => {
  await loginAs(page, "head-nurse");
  await expect(page.getByText("A 病区护士长", { exact: true })).toBeVisible();
  await page.getByText("床位监护", { exact: true }).first().click();

  await expect(page.getByText("A 病区 · 外科").first()).toBeVisible();
  await expect(page.getByText("B 病区 · 康复")).toHaveCount(0);
  await expect(page.getByText("管理中心", { exact: true })).toHaveCount(0);
});
