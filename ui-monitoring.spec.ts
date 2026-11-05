import { expect, test, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, "admin");
}

async function loginAs(
  page: Page,
  username: "admin" | "nurse" | "head-nurse" | "developer",
): Promise<void> {
  await page.goto("/#/overview", { waitUntil: "networkidle" });
  await expect(page.getByText("演示环境已跳过验证码，直接登录即可")).toBeVisible();
  await page.locator('input[placeholder="用户名"]').fill(username);
  await page.locator('input[placeholder="密码"]').fill("123456");
  const captchaInput = page.locator('input[placeholder="验证码"]');
  if (await captchaInput.count()) await captchaInput.fill("1");
  await page.locator(".login-card__submit").click();
  await page.waitForURL("**/#/overview");
}

async function openDevicePage(page: Page, label: string): Promise<void> {
  const group = page.locator(".el-sub-menu").filter({ hasText: "设备管理" });
  await group.locator(".el-sub-menu__title").click();
  await group.locator(".el-menu-item").filter({ hasText: label }).click();
}

test("nurse can open a bed monitor from the safety overview", async ({ page }) => {
  await loginAs(page, "nurse");

  await expect(page.getByRole("heading", { name: "安全总览" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "功能模块" })).toBeVisible();
  await expect(page.getByRole("button", { name: "收起列表" })).toBeVisible();
  const userAvatar = page.getByTestId("user-avatar");
  await expect(userAvatar).toBeVisible();
  expect(await userAvatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(
    0,
  );
  await page.screenshot({ path: "test-results/monitoring-overview.png", fullPage: true });
  await page.getByText("床位监护", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "床位监护" })).toBeVisible();
  await expect(page.getByText("A 病区 · 外科").first()).toBeVisible();
  expect(
    await page
      .locator(".bed-card__patient-identity img")
      .first()
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);

  await page.locator('[data-testid="bed-card"]').first().click();
  await expect(page).toHaveURL(/#\/beds\/bed-/);
  await expect(page.getByTestId("sensor-graphic")).toBeVisible();
  await expect(page.getByText("原始数据", { exact: true })).toBeVisible();
  await expect(page.getByText("ff,aa", { exact: true })).toBeVisible();
  await expect(page.getByText("传感器数据接口", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/medical-blanket\/v1\//)).toHaveCount(0);
  await expect(page.getByText(/\/api\/public\/sensors\/bed-a-01/)).toHaveCount(0);
  await expect(page.locator(".camera-links")).toHaveCount(0);
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
  await expect(page.getByText("床位告警").first()).toBeVisible();
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
  await expect(page.getByText("床位状态平稳").first()).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/monitoring-bed-detail.png", fullPage: true });
});

test("bed monitor stays usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, "nurse");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });

  await expect(page.getByTestId("sensor-graphic")).toBeVisible();
  await expect(page.getByText("床位告警").first()).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/monitoring-bed-mobile.png", fullPage: true });
});

test("binding page maps one camera to a bed without side-view options", async ({ page }) => {
  await loginAsAdmin(page);

  await openDevicePage(page, "设备绑定");
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
  await expect(page.getByText("已自动生成毯子传感器")).toBeVisible();
  await expect(page.locator(".generated-sensor-panel")).toContainText("blanket-a-100");
  await expect(page.locator(".generated-sensor-panel")).toContainText(
    "medical-blanket/v1/H001/WARD-A/301-03/sensor/blanket-a-100/data",
  );
  await page
    .locator(".generated-sensor-panel")
    .screenshot({ path: "test-results/monitoring-auto-sensor-panel.png" });

  await page.locator('[data-testid="bed-card"]').first().click();
  await page.getByRole("button", { name: "编辑患者信息" }).click();
  await page.locator('input[placeholder="患者姓名"]').fill("王小明");
  await page.locator('input[placeholder="住院号"]').fill("ZY20261104003");
  await page.getByText("观察中", { exact: true }).click();
  await page.getByRole("button", { name: "保存患者信息" }).click();
  await expect(page.getByText("患者信息已保存")).toBeVisible();

  await openDevicePage(page, "设备绑定");
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
  await expect(page.getByText("病区与病房", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("人员权限", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("告警与录像策略", { exact: true }).first()).toBeVisible();
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
  await page.getByRole("button", { name: "新增角色标签" }).click();
  await page.getByLabel("角色标签名称").fill("责任护士");
  await page.getByRole("button", { name: "确认添加标签" }).click();
  await expect(page.getByText("责任护士", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "新增人员" }).click();
  await expect(page.getByText("开放模块由开发者配置")).toBeVisible();
  await page.locator('input[placeholder="登录账号"]').fill("nurse-li");
  await page.locator('input[placeholder="人员姓名"]').fill("李护士");
  await page.locator('input[placeholder="登录密码"]').fill("Nurse@123456");
  await page.locator(".staff-tag-select .el-select__wrapper").click();
  await page.getByRole("option", { name: "责任护士", exact: true }).click();
  await page.getByRole("button", { name: "保存人员权限" }).click();
  await expect(page.getByText("李护士").first()).toBeVisible();
  await expect(page.locator(".staff-row").filter({ hasText: "李护士" })).toContainText("责任护士");
  await page.locator(".staff-page").screenshot({ path: "test-results/monitoring-staff-tags.png" });
  await page.screenshot({ path: "test-results/monitoring-navigation-groups.png" });

  await page.getByText("告警与录像策略", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "告警与录像策略" })).toBeVisible();
  await expect(page.getByText("系统连接", { exact: true })).toHaveCount(0);
});

test("developer can inspect MQTT credentials and runtime diagnostics", async ({ page }) => {
  await loginAs(page, "developer");
  await expect(page.getByText("系统开发者", { exact: true })).toBeVisible();

  await page
    .locator(".el-menu-item")
    .filter({ hasText: "开发者概览" })
    .click();
  await expect(page.getByRole("heading", { name: "开发者工作台" })).toBeVisible();
  await expect(page.getByText("实时运行数据")).toBeVisible();
  await expect(page.getByRole("button", { name: /毯子目录/ })).toBeVisible();
  await expect(page.getByText("MQTT 告警监听")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "告警床位" })).toBeVisible();
  await expect(page.getByLabel("警告内容")).toBeVisible();
  await expect(page.getByRole("button", { name: "下发警告" })).toBeVisible();
  await page.screenshot({ path: "test-results/monitoring-developer-overview-v2.png", fullPage: true });
  await page
    .locator(".alarm-test-panel")
    .screenshot({ path: "test-results/monitoring-alarm-dispatch.png" });
  await page.getByLabel("医院名称").fill("仁和医院");
  await page.getByRole("button", { name: "保存医院名称" }).click();
  await expect(page.getByText("医院名称已保存")).toBeVisible();
  await expect(page.getByText("仁和医院 · 开发者区域")).toBeVisible();

  await page.getByText("MQTT 管理", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "系统连接与 MQTT" })).toBeVisible();
  await expect(page.getByText("EMQX 接入")).toBeVisible();
  await expect(page.getByRole("heading", { name: "床位数据与告警", exact: true })).toBeVisible();
  const deviceGuide = page.locator(".device-onboarding");
  await expect(deviceGuide.getByRole("heading", { name: "设备接入四步" })).toBeVisible();
  await expect(deviceGuide.getByText("mqtt://10.208.236.217:1883", { exact: true })).toBeVisible();
  await expect(deviceGuide.getByText("blanket-service", { exact: true })).toBeVisible();
  await expect(deviceGuide).toContainText(
    "medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data",
  );
  await expect(deviceGuide).toContainText("发送后不返回消息");
  await deviceGuide.getByRole("button", { name: "复制接入参数" }).click();
  await expect(page.getByText("设备接入参数已复制")).toBeVisible();
  await deviceGuide.screenshot({ path: "test-results/monitoring-mqtt-device-guide.png" });
  await page.getByLabel("Client ID").fill("persisted-client-test");
  await page.getByRole("button", { name: "保存连接配置" }).click();
  await expect(page.getByText("MQTT 配置已保存")).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("Client ID")).toHaveValue("persisted-client-test");
  await expect(page.getByText("9 个数据主题")).toBeVisible();
  await expect(page.getByText("观测时间可以省略")).toBeVisible();
  await expect(page.getByText("http://10.208.236.217/api/public/time")).toBeVisible();
  await expect(page.getByText("medical-blanket/v1/system/time").first()).toBeVisible();
  await page
    .locator(".server-time-contract__links article")
    .filter({ hasText: "MQTT 保留时间主题" })
    .getByRole("button", { name: "复制" })
    .click();
  await expect(page.getByText("MQTT 时间主题已复制")).toBeVisible();
  await page
    .locator(".topic-panel--data")
    .getByRole("button", { name: "复制链接" })
    .first()
    .click();
  await expect(page.getByText("传感器数据链接已复制")).toBeVisible();
  await page.getByRole("tab", { name: /床位告警/ }).click();
  await expect(page.getByText("10 个床位告警主题")).toBeVisible();
  await page.locator(".topic-panel--alarm").getByRole("button", { name: "复制" }).first().click();
  await expect(page.getByText("床位告警主题已复制")).toBeVisible();
  await expect(
    page.locator(".message-card--data").getByRole("heading", { name: "传感器数据报文" }),
  ).toBeVisible();
  await expect(page.locator(".message-card--data pre")).toContainText('"metrics": {}');
  await expect(page.getByText("MQTT 原始报文")).toBeVisible();
  await expect(page.getByRole("heading", { name: "MQTT 连接文档", exact: true })).toBeVisible();
  await expect(page.locator(".document-panel .document-preview")).toContainText(
    "medical-blanket/v1/H001/WARD-A/301-01/alarm",
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

  await page
    .locator(".el-menu-item")
    .filter({ hasText: "开发者概览" })
    .click();
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

test("developer can create and rename a blanket and see the name in MQTT", async ({ page }) => {
  await loginAs(page, "developer");
  await openDevicePage(page, "毯子管理");
  await expect(page.getByRole("heading", { name: "毯子管理" })).toBeVisible();

  await page.getByRole("button", { name: "新建毯子" }).click();
  await page.getByLabel("毯子名称").fill("测试保暖毯");
  await page.locator(".el-dialog .el-select__wrapper").click();
  await page.getByRole("option", { name: /A 病区 · 外科 \/ 301 病房 \/ 01 床/ }).click();
  await page.getByRole("button", { name: "保存毯子" }).click();
  await expect(page.getByText("测试保暖毯").first()).toBeVisible();
  await expect(page.getByText("名称已同步到 MQTT").first()).toBeVisible();

  await page
    .locator(".blanket-row")
    .filter({ hasText: "测试保暖毯" })
    .getByRole("button", { name: "编辑毯子" })
    .click();
  await page.getByLabel("毯子名称").fill("测试智能毯");
  await page.getByRole("button", { name: "保存毯子" }).click();
  await expect(page.getByText("测试智能毯").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page
    .locator(".blanket-page")
    .screenshot({ path: "test-results/monitoring-blanket-management.png" });

  await page.getByText("MQTT 管理", { exact: true }).first().click();
  await expect(page.locator(".device-onboarding")).toContainText("测试智能毯");
});

test("administrator can manage camera names and locations without stream links", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await openDevicePage(page, "摄像头管理");

  await expect(page.getByRole("heading", { name: "摄像头管理" })).toBeVisible();
  await expect(page.getByText("WebRTC 浏览器观看")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "视频连接文档" })).toHaveCount(0);
  await page.getByRole("button", { name: "新增摄像头" }).click();
  await page.getByLabel("摄像头名称").fill("302 病房摄像头");
  await page.locator(".camera-location-select .el-select__wrapper").click();
  await page.getByRole("option", { name: /302 病房 \/ 01 床/ }).click();
  await page.getByRole("button", { name: "保存摄像头" }).click();
  await expect(page.getByText("摄像头已保存")).toBeVisible();
  await expect(page.getByText("302 病房摄像头").first()).toBeVisible();
  await expect(page.getByText(/A 病区 · 外科 \/ 302 病房 \/ 01 床/).first()).toBeVisible();
});

test("developer can still see technical MQTT and camera links in bed detail", async ({ page }) => {
  await loginAs(page, "developer");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });

  await expect(page.locator(".sensor-links")).toBeVisible();
  await expect(page.locator(".camera-links")).toBeVisible();
  await expect(
    page.getByText("medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data").first(),
  ).toBeVisible();
  await expect(page.getByText("本床位独立告警 Topic")).toBeVisible();
});

test("developer can rename the platform brand", async ({ page }) => {
  await loginAs(page, "developer");
  await page
    .locator(".el-menu-item")
    .filter({ hasText: "开发者概览" })
    .click();
  await page.getByLabel("平台名称").fill("康复毯监测中心");
  await page.getByRole("button", { name: "保存平台名称" }).click();
  await expect(page.getByText("平台名称已保存")).toBeVisible();
  await expect(page.locator(".layout-logo__title")).toHaveText("康复毯监测中心");
});

test("developer can send a bed notification through the MQTT service", async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null;
  await page.route("**/api/developer/notify", async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await loginAs(page, "developer");
  await page
    .locator(".el-menu-item")
    .filter({ hasText: "开发者概览" })
    .click();
  await page.getByLabel("警告内容").fill("请检查当前床位毯子状态");
  await page.getByRole("button", { name: "下发警告" }).click();
  await expect(page.getByText(/警告已通过 MQTT 下发到/)).toBeVisible();
  expect(requestBody).toMatchObject({
    topic: "medical-blanket/v1/H001/WARD-A/301-01/alarm",
    notification: {
      type: "notification",
      bedId: "bed-a-01",
      level: "WARNING",
      title: "请检查当前床位毯子状态",
    },
  });
});

test("live MQTT warning is displayed as the same red bed alarm", async ({ page, request }) => {
  const liveOrigin = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(!liveOrigin?.startsWith("http://192.168."), "requires the deployed LAN site");

  await loginAs(page, "developer");
  await page.waitForTimeout(1_000);
  const alarmId = `live-warning-${Date.now()}`;
  const response = await request.post(`${liveOrigin}/api/developer/notify`, {
    data: {
      topic: "medical-blanket/v1/H001/WARD-A/301-01/alarm",
      notification: {
        type: "notification",
        alarmId,
        level: "WARNING",
        title: "MQTT 红色告警联调",
        bedId: "bed-a-01",
        occurredAt: new Date().toISOString(),
      },
    },
  });
  expect(response.ok()).toBe(true);

  await expect(page.locator(".navbar-alert-badge")).toHaveText("1");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });
  await expect(page.locator(".alarm-card").filter({ hasText: "MQTT 红色告警联调" })).toHaveAttribute(
    "data-status",
    "OPEN",
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

test("warning turns red and requires nurse actions to resolve and delete", async ({ page }) => {
  await loginAs(page, "developer");
  await expect(page.locator(".navbar-unbound-badge")).toBeVisible();
  await expect(page.locator(".navbar-alert-badge")).toHaveCount(0);
  await page
    .locator(".el-menu-item")
    .filter({ hasText: "开发者概览" })
    .click();
  await page.getByRole("button", { name: "发送测试告警并查看" }).click();

  await expect(page).toHaveURL(/\/beds\/bed-a-01/);
  await expect(page.locator(".el-notification")).toContainText("01 床告警");
  await expect(page.locator(".navbar-alert-badge")).toHaveText("1");
  const alarmCard = page.locator(".alarm-card").first();
  await expect(alarmCard).toHaveAttribute("data-status", "OPEN");
  await expect(alarmCard).toHaveAttribute("data-level", "WARNING");
  await expect(alarmCard).toContainText("毯子状态异常");
  await alarmCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/monitoring-alarm-open.png", fullPage: true });
  await page.getByRole("button", { name: "查看回放" }).click();
  await expect
    .poll(
      async () =>
        (await page.locator(".recording-player").count()) +
        (await page.getByText("该告警时刻暂无对应录像片段").count()),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "标记已解决" }).click();
  await expect(alarmCard).toHaveAttribute("data-status", "RESOLVED");
  await expect(page.locator(".navbar-alert-badge")).toHaveCount(0);
  await alarmCard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/monitoring-alarm-resolved.png", fullPage: true });
  await page.waitForTimeout(3_300);
  await expect(alarmCard).toHaveAttribute("data-status", "RESOLVED");
  await page.getByRole("button", { name: "删除记录" }).click();
  await expect(page.getByText("床位状态平稳").first()).toBeVisible();
});
