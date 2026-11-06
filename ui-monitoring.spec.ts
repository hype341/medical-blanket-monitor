import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, "admin");
}

async function fillCaptcha(page: Page): Promise<void> {
  const captchaInput = page.locator('input[placeholder="验证码"]');
  const mathChallenge = page.locator(".login-card__math-captcha strong");
  if (!(await mathChallenge.count())) {
    await captchaInput.fill("1");
    return;
  }
  const question = (await mathChallenge.textContent())?.trim() ?? "";
  const match = question.match(/(\d+)\s*([+-])\s*(\d+)/);
  if (!match) throw new Error(`无法识别验证码题目: ${question}`);
  const answer =
    match[2] === "+"
      ? Number(match[1]) + Number(match[3])
      : Number(match[1]) - Number(match[3]);
  await captchaInput.fill(String(answer));
}

async function loginAs(
  page: Page,
  username: string,
  password = "123456",
): Promise<void> {
  await page.goto("/#/overview", { waitUntil: "networkidle" });
  await expect(page.locator('input[placeholder="验证码"]')).toBeVisible();
  await page.locator('input[placeholder="用户名"]').fill(username);
  await page.locator('input[placeholder="密码"]').fill(password);
  await fillCaptcha(page);
  await page.locator(".login-card__submit").click();
  try {
    await page.waitForURL("**/#/overview", { timeout: 10_000 });
  } catch {
    await page.locator('input[placeholder="用户名"]').fill(username);
    await page.locator('input[placeholder="密码"]').fill(password);
    await fillCaptcha(page);
    await page.locator(".login-card__submit").click();
    await page.waitForURL("**/#/overview", { timeout: 15_000 });
  }
}

async function logoutFromUi(page: Page): Promise<void> {
  await page.locator(".layout-user").click();
  await page.getByText("退出登录", { exact: true }).click();
  await page.getByRole("button", { name: "确定" }).click();
  await page.waitForURL("**/#/login**");
}

function clockSeconds(value: string | null): number {
  const match = value?.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return Number.NaN;
  return Number(match[1]) * 3_600 + Number(match[2]) * 60 + Number(match[3]);
}

function clockDistance(value: string | null, target: Date): number {
  const current = clockSeconds(value);
  const expected = target.getHours() * 3_600 + target.getMinutes() * 60 + target.getSeconds();
  const direct = Math.abs(current - expected);
  return Math.min(direct, 86_400 - direct);
}

async function seekRecordingTo(page: Page, target: Date): Promise<number> {
  const localValue = await page.evaluate((iso) => {
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 19);
  }, target.toISOString());
  const input = page.locator('input[aria-label="按时间定位回放"]');
  await input.fill(localValue);
  const startedAt = Date.now();
  await page.getByRole("button", { name: "回放此时间", exact: true }).click();
  await expect(page.locator(".recording-player")).toHaveAttribute("data-state", "playing", {
    timeout: 8_000,
  });
  return Date.now() - startedAt;
}

async function openDevicePage(page: Page, label: string): Promise<void> {
  const group = page.locator(".el-sub-menu").filter({ hasText: "设备管理" });
  await group.locator(".el-sub-menu__title").click();
  await group.locator(".el-menu-item").filter({ hasText: label }).click();
}

async function clearLiveAlarms(
  request: APIRequestContext,
  liveOrigin: string,
): Promise<void> {
  const response = await request.get(`${liveOrigin}/api/public/alarms`);
  if (!response.ok()) return;
  const alarms = (await response.json()) as Array<{ alarmId?: string }>;
  for (const alarm of alarms) {
    if (alarm.alarmId) {
      await request.delete(`${liveOrigin}/api/alarms/${encodeURIComponent(alarm.alarmId)}`);
    }
  }
}

async function isCameraNodeOnline(): Promise<boolean> {
  try {
    const start = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    const end = new Date(Date.now() + 60_000).toISOString();
    const listUrl = new URL("http://10.208.236.131:9996/list");
    listUrl.search = new URLSearchParams({ path: "camera-01", start, end }).toString();
    const listResponse = await fetch(listUrl, { signal: AbortSignal.timeout(6_000) });
    if (!listResponse.ok) return false;
    const items = (await listResponse.json()) as Array<{ url?: string }>;
    const playbackUrl = items.find((item) => item.url)?.url;
    if (!playbackUrl) return false;
    const playbackResponse = await fetch(playbackUrl, {
      headers: { Range: "bytes=0-0" },
      signal: AbortSignal.timeout(6_000),
    });
    await playbackResponse.body?.cancel();
    return playbackResponse.ok;
  } catch {
    return false;
  }
}

test("login rejects an invalid captcha before account validation", async ({ page }) => {
  await page.goto("/#/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: "test-results/monitoring-login-captcha.png", fullPage: true });
  await page.locator('input[placeholder="用户名"]').fill("admin");
  await page.locator('input[placeholder="密码"]').fill("123456");
  await page.locator('input[placeholder="验证码"]').fill("99999");
  await page.locator(".login-card__submit").click();

  await expect(page.getByText("验证码错误或已过期，请重新输入")).toBeVisible();
  await expect(page).toHaveURL(/\/#\/login/);
  await expect(page.locator(".login-card__math-captcha")).toBeVisible();
});

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
  const livePlayerBounds = await page.locator(".detail-player").boundingBox();
  expect(livePlayerBounds).not.toBeNull();
  expect(livePlayerBounds!.width / livePlayerBounds!.height).toBeGreaterThan(1.5);
  await expect(page.getByTestId("sensor-heatmap")).toContainText("28 点/列 · 64 列");
  await expect(page.getByTestId("sensor-heatmap")).toContainText("1792 / 1792");
  await expect(page.getByText("1792 字节数据", { exact: true })).toHaveCount(0);
  await expect(page.locator(".sensor-graphic__raw-data")).toHaveCount(0);
  await expect(page.getByText("传感器数据接口", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/medical-blanket\/v1\//)).toHaveCount(0);
  await expect(page.getByText(/\/api\/public\/sensors\/bed-a-01/)).toHaveCount(0);
  await expect(page.locator(".camera-links")).toHaveCount(0);
  await expect(page.getByText(/sensor\/.+\/telemetry/)).toHaveCount(0);
  await expect(page.getByText("毯面温度")).toHaveCount(0);
  await expect(page.getByText("设备电量")).toHaveCount(0);
  await expect(page.getByLabel("传感器图形帧率")).toHaveCount(0);
  await expect(page.getByText("热力图刷新帧率")).toHaveCount(0);
  await expect(page.getByText(/帧\/秒/)).toHaveCount(0);
  await expect(page.getByText("数据滤波调参")).toHaveCount(0);
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

test("developer receives sensor MQTT data and controls heatmap frame rate", async ({ page }) => {
  const mqttSockets: string[] = [];
  page.on("websocket", (socket) => mqttSockets.push(socket.url()));

  await loginAs(page, "developer");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });

  const heatmap = page.getByTestId("sensor-heatmap");
  await expect(heatmap).toBeVisible();
  await expect(heatmap).toContainText("28 点/列 · 64 列");
  await expect(heatmap).toContainText("1792 / 1792");
  await expect(heatmap).toHaveAttribute("data-rendered-points", "1792");
  const tuningPanel = page.locator(".sensor-filter-panel");
  await expect(tuningPanel.getByRole("heading", { name: "数据滤波调参" })).toBeVisible();
  await expect(tuningPanel).toContainText("实时平均值");
  await tuningPanel.getByLabel("滤波方式").click();
  await page.getByRole("option", { name: "中值滤波" }).click();
  await tuningPanel.getByLabel("丢弃阈值").fill("20");
  await expect(tuningPanel).toContainText("有效点");
  const coloredPixels = await heatmap.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 45) colored += 1;
    }
    return colored;
  });
  expect(coloredPixels).toBeGreaterThan(25_000);
  await expect(page.locator(".sensor-graphic__raw-data code")).toHaveText(
    /^[0-9a-f]{2}(,[0-9a-f]{2})+/,
  );
  await heatmap.getByRole("button", { name: "放大热力图" }).click();
  const heatmapDialog = page.getByRole("dialog", { name: "毯面感应热力图" });
  await expect(heatmapDialog).toBeVisible();
  await expect(heatmapDialog.locator("img")).toBeVisible();
  await heatmapDialog.getByRole("button", { name: "关闭热力图" }).click();
  await expect(heatmapDialog).toHaveCount(0);
  await page.locator(".sensor-panel").screenshot({
    path: "test-results/monitoring-sensor-heatmap.png",
  });
  const refreshRate = page.getByLabel("传感器图形帧率");
  await expect(refreshRate).toBeVisible();
  await refreshRate.fill("7");
  await expect(refreshRate).toHaveValue("7");
  await page.getByRole("button", { name: "5 帧/秒", exact: true }).click();
  await expect(refreshRate).toHaveValue("5");
  await expect
    .poll(() => mqttSockets.some((url) => url.includes(":8083/mqtt")), { timeout: 15_000 })
    .toBe(true);
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

test("administrator can delete a bed from bed monitoring", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/#/beds", { waitUntil: "networkidle" });
  const before = Number(await page.locator(".bed-list-header__count strong").textContent());
  const firstCard = page.locator('[data-testid="bed-card"]').first();
  await firstCard.getByRole("button", { name: "删除床位" }).click();
  await page.getByRole("button", { name: "删除床位", exact: true }).last().click();

  await expect(page.getByText("床位已删除")).toBeVisible();
  await expect(page.locator(".bed-list-header__count strong")).toHaveText(String(before - 1));
});

test("administrator can delete blankets, cameras, and staff with guarded organization data", async ({
  page,
}) => {
  await loginAsAdmin(page);

  await openDevicePage(page, "毯子管理");
  const blanketRowsBefore = await page.locator(".blanket-row").count();
  await page
    .locator(".blanket-row")
    .first()
    .getByRole("button", { name: "删除", exact: true })
    .click();
  await page.getByRole("button", { name: "删除毯子", exact: true }).click();
  await expect(page.getByText("毯子已删除")).toBeVisible();
  await expect(page.locator(".blanket-row")).toHaveCount(blanketRowsBefore - 1);

  await openDevicePage(page, "摄像头管理");
  await expect(page.getByRole("heading", { name: "摄像头管理" })).toBeVisible();
  await expect(page.locator(".camera-table .el-table__row").first()).toBeVisible();
  const cameraRowsBefore = await page.locator(".camera-table .el-table__row").count();
  await page.locator(".camera-table .el-table__row").first().getByRole("button", { name: "删除" }).click();
  await page.getByRole("button", { name: "删除摄像头", exact: true }).click();
  await expect(page.getByText("摄像头已删除")).toBeVisible();
  await expect(page.locator(".camera-table .el-table__row")).toHaveCount(cameraRowsBefore - 1);

  await page.goto("/#/admin/staff", { waitUntil: "networkidle" });
  const nurseRow = page.locator(".staff-row").filter({ hasText: "值班护士" }).first();
  await nurseRow.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "删除账号", exact: true }).click();
  await expect(page.getByText("人员账号已删除")).toBeVisible();
  await expect(page.locator(".staff-row").filter({ hasText: "值班护士" })).toHaveCount(0);

  await page.goto("/#/admin/wards", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "删除病区", exact: true }).click();
  await page.getByRole("button", { name: "删除病区", exact: true }).last().click();
  await expect(page.getByText("还有病房或床位，不能直接删除")).toBeVisible();
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
  const ownAdminRow = page.locator(".staff-row").filter({ hasText: "系统管理员" }).first();
  await expect(ownAdminRow.getByText("不可管理", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "新增角色标签" }).click();
  await page.getByLabel("角色标签名称").fill("责任护士");
  await page.getByRole("button", { name: "确认添加标签" }).click();
  await expect(page.getByText("责任护士", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "新增人员" }).click();
  await expect(page.getByText("仅显示当前账号已拥有的模块")).toBeVisible();
  await expect(page.locator(".el-radio-button").filter({ hasText: "管理员" })).toHaveCount(0);
  await page.locator('input[placeholder="登录账号"]').fill("nurse-li");
  await page.locator('input[placeholder="人员姓名"]').fill("李护士");
  await page.locator('input[placeholder="登录密码"]').fill("Nurse@123456");
  await page.locator(".staff-tag-select .el-select__wrapper").click();
  await page.getByRole("option", { name: "责任护士", exact: true }).click();
  await page.getByRole("button", { name: "保存人员权限" }).click();
  await expect(page.getByText("李护士").first()).toBeVisible();
  await expect(page.locator(".staff-row").filter({ hasText: "李护士" })).toContainText("责任护士");
  await page.waitForTimeout(600);
  await page.locator(".staff-page").screenshot({ path: "test-results/monitoring-staff-tags.png" });
  await page.screenshot({ path: "test-results/monitoring-navigation-groups.png" });

  await page.getByText("告警与录像策略", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "告警与录像策略" })).toBeVisible();
  await expect(page.getByText("系统连接", { exact: true })).toHaveCount(0);

  await logoutFromUi(page);
  await loginAs(page, "nurse-li", "Nurse@123456");
  await expect(page.getByText("李护士", { exact: true })).toBeVisible();
  await expect(page.getByText("值班护士", { exact: true })).toHaveCount(0);
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
  const subscriptionPanel = page.locator(".external-subscription");
  await expect(
    subscriptionPanel.getByRole("heading", { name: "毯子数据订阅主题" }),
  ).toBeVisible();
  await expect(subscriptionPanel).toContainText(
    "medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data",
  );
  await subscriptionPanel.getByRole("button", { name: "复制全部订阅主题" }).click();
  await expect(page.getByText("毯子订阅主题已复制")).toBeVisible();
  await subscriptionPanel.screenshot({
    path: "test-results/monitoring-mqtt-subscriptions.png",
  });
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
  const bedDataLink = page.locator(".topic-panel--data .data-topic-value small").first();
  await expect(bedDataLink).toContainText("/hex");
  await page.locator(".topic-view-switch").getByRole("button", { name: "原始帧" }).click();
  await expect(bedDataLink).toContainText("/raw-hex");
  await page.locator(".topic-view-switch").getByRole("button", { name: "完整报文" }).click();
  await expect(bedDataLink).not.toContainText("/hex");
  await page.getByRole("tab", { name: /床位告警/ }).click();
  await expect(page.getByText("10 个床位告警主题")).toBeVisible();
  await page.locator(".topic-panel--alarm").getByRole("button", { name: "复制" }).first().click();
  await expect(page.getByText("床位告警主题已复制")).toBeVisible();
  const dataMessageCard = page.locator(".message-card--data");
  await expect(dataMessageCard.getByRole("heading", { name: "传感器数据报文" })).toBeVisible();
  await expect(dataMessageCard.locator("pre")).not.toContainText("等待传感器数据");
  await dataMessageCard.getByRole("button", { name: "原始帧" }).click();
  await expect(dataMessageCard.locator("pre")).toContainText("ff,aa");
  await dataMessageCard.getByRole("button", { name: "完整报文" }).click();
  await expect(dataMessageCard.locator("pre")).toContainText('"metrics"');
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
  await page.getByRole("button", { name: "生成文档", exact: true }).click();
  await expect(page.locator(".camera-document .document-preview")).toContainText(
    "http://10.208.236.131:8889/camera-01/whep",
  );
  await expect(page.locator(".camera-document .document-preview")).toContainText(
    "rtmp://10.208.236.131:1935/camera-01",
  );

  await page.getByRole("button", { name: "批量导入", exact: true }).click();
  const csvRows = Array.from(
    { length: 24 },
    (_, index) =>
      `批量摄像头${index + 1},camera-bulk-${index + 1},camera-bulk-${index + 1},http://10.208.236.131,通用,IMX219`,
  );
  await page
    .locator(".camera-bulk-import textarea")
    .fill(["name,cameraKey,mediaPath,mediaServerUrl,vendor,model", ...csvRows].join("\n"));
  await page.getByRole("button", { name: "导入摄像头", exact: true }).click();
  await expect(page.getByText("已导入 24 台摄像头")).toBeVisible();
  await expect(page.locator(".camera-filters > span")).toContainText("26 / 26");
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

test("developer can create a custom-named blanket from MQTT management", async ({ page }) => {
  await loginAs(page, "developer");
  await page.goto("/#/admin/connections", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建毯子并生成主题" }).click();

  const dialog = page.locator(".mqtt-blanket-dialog");
  await dialog.getByLabel("新建毯子名称").fill("MQTT 新建护理毯");
  await dialog.locator(".el-select__wrapper").click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("button", { name: "保存并生成主题" }).click();

  const result = page.locator(".created-blanket-panel");
  await expect(result).toContainText("MQTT 新建护理毯");
  await expect(result).toContainText("blanket-device-100");
  await expect(result).toContainText("/data");
  await expect(result).toContainText("/alarm");
  await expect(page.locator(".device-onboarding")).toContainText("MQTT 新建护理毯");
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

test("camera status matches browser media reachability", async ({ page, request }) => {
  const mediaResponse = await request.get(
    "http://10.208.236.131:8888/camera-01/index.m3u8?cookieCheck=1",
  );

  await loginAsAdmin(page);
  await openDevicePage(page, "摄像头管理");
  const cameraRow = page.locator(".el-table__row").filter({ hasText: "301 病房摄像头" }).first();
  await expect(cameraRow).toContainText(mediaResponse.ok() ? "在线" : "离线");
  await page.screenshot({ path: "test-results/monitoring-camera-status.png", fullPage: true });
});

test("recorded video plays and advances when the camera node is online", async ({ page }) => {
  const liveOrigin = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(!liveOrigin?.startsWith("http://192.168."), "requires the deployed LAN site");
  test.skip(process.env.PLAYWRIGHT_LIVE_MEDIA !== "1", "run with PLAYWRIGHT_LIVE_MEDIA=1");
  test.skip(!(await isCameraNodeOnline()), "camera node is offline");

  await loginAs(page, "nurse");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });
  const segment = page.locator(".recording-timeline__segment").first();
  await expect(segment).toBeVisible({ timeout: 20_000 });
  await seekRecordingTo(page, new Date(Date.now() - 5 * 60_000));

  const player = page.locator(".recording-player");
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 });
  const playbackBounds = await player.boundingBox();
  expect(playbackBounds).not.toBeNull();
  expect(playbackBounds!.width / playbackBounds!.height).toBeGreaterThan(1.5);
  const timeLabel = player.locator(".recording-player__chrome strong");
  const before = await timeLabel.textContent();
  await page.waitForTimeout(2_500);
  await expect(timeLabel).not.toHaveText(before ?? "");
  await page.screenshot({ path: "test-results/monitoring-playback-live.png", fullPage: true });
});

test("recording seeks quickly and switches to another timestamp without stale loading", async ({
  page,
}) => {
  const liveOrigin = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(!liveOrigin?.startsWith("http://192.168."), "requires the deployed LAN site");
  test.skip(process.env.PLAYWRIGHT_LIVE_MEDIA !== "1", "run with PLAYWRIGHT_LIVE_MEDIA=1");
  test.skip(!(await isCameraNodeOnline()), "camera node is offline");

  await loginAs(page, "nurse");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });
  await expect(page.locator(".recording-timeline__segment").first()).toBeVisible({
    timeout: 20_000,
  });

  const firstTarget = new Date(Date.now() - 5 * 60_000);
  const firstDuration = await seekRecordingTo(page, firstTarget);
  expect(firstDuration).toBeLessThan(8_000);
  await page.waitForTimeout(750);
  await expect
    .poll(
      async () =>
        clockDistance(
          await page.locator(".recording-player__chrome strong").textContent(),
          firstTarget,
        ),
      { timeout: 4_000 },
    )
    .toBeLessThanOrEqual(3);

  const secondTarget = new Date(firstTarget.getTime() - 60_000);
  const secondDuration = await seekRecordingTo(page, secondTarget);
  expect(secondDuration).toBeLessThan(5_000);
  await expect
    .poll(
      async () =>
        clockDistance(
          await page.locator(".recording-player__chrome strong").textContent(),
          secondTarget,
        ),
      { timeout: 4_000 },
    )
    .toBeLessThanOrEqual(3);
});

test("recorded playback keeps advancing without long visible freezes", async ({
  page,
}) => {
  const liveOrigin = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(!liveOrigin?.startsWith("http://192.168."), "requires the deployed LAN site");
  test.skip(process.env.PLAYWRIGHT_LIVE_MEDIA !== "1", "run with PLAYWRIGHT_LIVE_MEDIA=1");
  test.skip(!(await isCameraNodeOnline()), "camera node is offline");

  await loginAs(page, "nurse");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });
  const segment = page.locator(".recording-timeline__segment").first();
  await expect(segment).toBeVisible({ timeout: 20_000 });
  await segment.click();

  const player = page.locator(".recording-player");
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 });
  const timeLabel = player.locator(".recording-player__chrome strong");
  const samples: string[] = [];
  for (let index = 0; index < 20; index += 1) {
    samples.push((await timeLabel.textContent()) ?? "");
    await page.waitForTimeout(500);
  }

  const seconds = samples.map(clockSeconds).filter(Number.isFinite);
  const gaps = seconds.slice(1).map((value, index) => value - seconds[index]);
  expect(seconds.length).toBeGreaterThan(18);
  expect(gaps.every((gap) => gap >= 0), `playback clock samples: ${samples.join(", ")}`).toBe(true);
  expect(Math.max(...gaps)).toBeLessThanOrEqual(2);
  expect(seconds.at(-1)! - seconds[0]).toBeGreaterThanOrEqual(8);
});

test("recording timeline stays anchored while playback position moves", async ({ page }) => {
  const liveOrigin = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(!liveOrigin?.startsWith("http://192.168."), "requires the deployed LAN site");
  const now = Date.now();
  await page.route(/http:\/\/10\.208\.236\.131:9996\/list\?.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          start: new Date(now - 4 * 60_000).toISOString(),
          duration: 60,
          url: `http://10.208.236.131:9996/get?path=camera-01&start=${encodeURIComponent(
            new Date(now - 4 * 60_000).toISOString(),
          )}&duration=60`,
        },
        {
          start: new Date(now - 2 * 60_000).toISOString(),
          duration: 60,
          url: `http://10.208.236.131:9996/get?path=camera-01&start=${encodeURIComponent(
            new Date(now - 2 * 60_000).toISOString(),
          )}&duration=60`,
        },
      ]),
    });
  });

  await loginAs(page, "nurse");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });
  const segment = page.locator(".recording-timeline__segment").first();
  await expect(segment).toBeVisible({ timeout: 20_000 });
  await segment.click();
  await page.waitForTimeout(500);

  const windowStart = page.locator(".recording-timeline__clock span").first();
  const progress = page.getByLabel("录像回放进度");
  const beforeWindow = await windowStart.textContent();
  const beforeProgress = Number(await progress.inputValue());
  await page.locator(".recording-timeline__segment").nth(1).click();
  await page.waitForTimeout(1_500);

  expect(Number(await progress.inputValue())).toBeGreaterThan(beforeProgress);
  expect(await windowStart.textContent()).toBe(beforeWindow);
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
  await expect(page.locator(".sensor-links__list code").first()).toContainText("/hex");
  await page.getByRole("button", { name: "原始帧", exact: true }).click();
  await expect(page.locator(".sensor-links__list code").first()).toContainText("/raw-hex");
  await page.getByRole("button", { name: "完整报文", exact: true }).click();
  await expect(page.locator(".sensor-links__list code").first()).toContainText("/api/public/sensors/");
  await expect(page.locator(".sensor-links__list code").first()).not.toContainText("/hex");
  await page.getByRole("button", { name: "1792 字节数据", exact: true }).click();
  await page.locator(".sensor-links__list").getByRole("button", { name: "打开" }).click();
  await expect(page).toHaveURL(/\/api\/public\/sensors\/bed-a-01\/hex$/);
  await expect(page.locator("body")).toContainText(/^[0-9a-f]{2}(,[0-9a-f]{2})+/);
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

test("refreshing and switching monitored pages does not raise Vue DOM errors", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /insertBefore|parentNode|_leaveCb|nextSibling/.test(message.text())
    ) {
      pageErrors.push(message.text());
    }
  });

  await loginAs(page, "developer");
  const routes = [
    "/#/overview",
    "/#/beds/bed-a-01",
    "/#/admin/developer",
    "/#/devices/blankets",
    "/#/admin/staff",
    "/#/admin/policy",
  ];
  for (let index = 0; index < 24; index += 1) {
    await page.goto(routes[index % routes.length], { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
  }

  expect(pageErrors).toEqual([]);
});

test("refresh current tab stays in the same page and keeps the login session", async ({ page }) => {
  await loginAs(page, "developer");
  await page.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });
  let popupCount = 0;
  page.on("popup", () => {
    popupCount += 1;
  });

  await page.getByRole("button", { name: "刷新当前" }).first().click();
  await page.waitForTimeout(800);
  expect(popupCount).toBe(0);
  await expect(page).toHaveURL(/#\/beds\/bed-a-01/);
  await expect(page.getByRole("heading", { name: /01 床/ })).toBeVisible();
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

  await clearLiveAlarms(request, liveOrigin!);
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
  await request.delete(`${liveOrigin}/api/alarms/${encodeURIComponent(alarmId)}`);
});

test("resolved MQTT alarm synchronizes across open platform pages", async ({ browser, request }) => {
  const liveOrigin = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(!liveOrigin?.startsWith("http://192.168."), "requires the deployed LAN site");

  await clearLiveAlarms(request, liveOrigin!);
  const watcherContext = await browser.newContext();
  const operatorContext = await browser.newContext();
  const watcher = await watcherContext.newPage();
  const operator = await operatorContext.newPage();

  try {
    await loginAs(watcher, "admin");
    await loginAs(operator, "nurse");
    await watcher.waitForTimeout(1_000);
    const alarmId = `live-sync-${Date.now()}`;
    const response = await request.post(`${liveOrigin}/api/developer/notify`, {
      data: {
        topic: "medical-blanket/v1/H001/WARD-A/301-01/alarm",
        notification: {
          type: "notification",
          alarmId,
          level: "WARNING",
          title: "跨页面同步告警",
          bedId: "bed-a-01",
          occurredAt: new Date().toISOString(),
        },
      },
    });
    expect(response.ok()).toBe(true);
    await expect(watcher.locator(".navbar-alert-badge")).toHaveText("1");
    await expect(operator.locator(".navbar-alert-badge")).toHaveText("1");

    await operator.goto("/#/beds/bed-a-01", { waitUntil: "networkidle" });
    await operator.getByRole("button", { name: "标记已解决" }).click();
    await expect(watcher.locator(".navbar-alert-badge")).toHaveCount(0);
    await expect(
      operator.locator(".alarm-card").filter({ hasText: "跨页面同步告警" }),
    ).toHaveAttribute("data-status", "RESOLVED");
    await request.delete(`${liveOrigin}/api/alarms/${encodeURIComponent(alarmId)}`);
  } finally {
    await watcherContext.close();
    await operatorContext.close();
  }
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
  const liveOrigin = process.env.PLAYWRIGHT_BASE_URL;
  if (liveOrigin?.startsWith("http://192.168.")) {
    const response = await page.request.get(`${liveOrigin}/api/public/alarms`);
    if (response.ok()) {
      const alarms = (await response.json()) as Array<{ alarmId?: string }>;
      for (const alarm of alarms) {
        if (alarm.alarmId) {
          await page.request.delete(
            `${liveOrigin}/api/alarms/${encodeURIComponent(alarm.alarmId)}`,
          );
        }
      }
    }
  }
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

test("nurse can filter urgent beds, copy a handoff summary, and reopen recent beds", async ({
  page,
}) => {
  await loginAs(page, "nurse");
  await page.goto("/#/beds", { waitUntil: "networkidle" });

  await expect(page.getByRole("button", { name: /待处理告警/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /设备待绑定/ })).toBeVisible();
  await page.getByRole("button", { name: "复制交班摘要" }).click();
  await expect(page.getByText("交班摘要已复制")).toBeVisible();

  const firstBed = page.locator('[data-testid="bed-card"]').first();
  await firstBed.click();
  await expect(page).toHaveURL(/#\/beds\/bed-/);
  await page.goto("/#/beds", { waitUntil: "networkidle" });
  await expect(page.getByText("最近查看", { exact: true })).toBeVisible();
  await expect(page.locator(".recent-beds")).toContainText("床");
});

test("developer maintenance center checks services and exports diagnostics", async ({ page }) => {
  await loginAs(page, "developer");
  await page.goto("/#/admin/maintenance", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "维护中心" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "系统健康" })).toBeVisible();
  await expect(page.locator(".diagnostic-row")).toHaveCount(5);
  await expect(page.getByText("视频流媒体节点", { exact: true })).toBeVisible();
  await expect(page.getByText("浏览器自动保存", { exact: true })).toBeVisible();
  await expect(page.getByText("不含 MQTT 密码", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载维护报告" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^medical-blanket-diagnostics-.*\.json$/);

  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /导出配置备份/ }).click();
  const backup = await backupPromise;
  expect(backup.suggestedFilename()).toMatch(/^medical-blanket-backup-.*\.json$/);
  await page.screenshot({ path: "test-results/monitoring-maintenance.png", fullPage: true });
});

test("large device inventory stays paginated and does not render every bed", async ({ page }) => {
  test.setTimeout(45_000);
  await loginAs(page, "developer");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = localStorage.getItem("monitoring-business-data");
          if (!raw) return 0;
          return (JSON.parse(raw) as { data: { beds: unknown[] } }).data.beds.length;
        }),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0);

  const scaledInventory = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("monitoring-business-data")!) as {
      schemaVersion: number;
      data: {
        beds: Array<Record<string, unknown>>;
        sensors: Array<Record<string, unknown>>;
        cameras: Array<Record<string, unknown>>;
        bindings: Array<Record<string, unknown>>;
      };
    };
    const baseBed = stored.data.beds[0];
    const baseSensor = stored.data.sensors[0];
    const baseCamera = stored.data.cameras[0];
    stored.data.beds = Array.from({ length: 1_000 }, (_, index) => ({
      ...structuredClone(baseBed),
      id: `bed-scale-${index}`,
      bedNo: String((index % 99) + 1).padStart(2, "0"),
      patientName: `容量测试患者 ${index + 1}`,
    }));
    stored.data.sensors = Array.from({ length: 1_000 }, (_, index) => ({
      ...structuredClone(baseSensor),
      id: `sensor-bed-scale-${index}`,
      deviceKey: `blanket-scale-${index}`,
      name: `容量测试毯子 ${index + 1}`,
      status: "ONLINE",
    }));
    stored.data.cameras = Array.from({ length: 1_000 }, (_, index) => ({
      ...structuredClone(baseCamera),
      id: `camera-scale-${index}`,
      cameraKey: `camera-scale-${index}`,
      mediaPath: `camera-scale-${index}`,
      name: `容量测试摄像头 ${index + 1}`,
      status: "OFFLINE",
    }));
    stored.data.bindings = Array.from({ length: 1_000 }, (_, index) => [
      {
        id: `binding-scale-sensor-${index}`,
        bedId: `bed-scale-${index}`,
        sensorDeviceId: `sensor-bed-scale-${index}`,
        cameraId: null,
        role: "PRIMARY_SENSOR",
        status: "ACTIVE",
      },
      {
        id: `binding-scale-camera-${index}`,
        bedId: `bed-scale-${index}`,
        sensorDeviceId: null,
        cameraId: `camera-scale-${index}`,
        role: "PRIMARY_CAMERA",
        status: "ACTIVE",
      },
    ]).flat();
    return JSON.stringify(stored);
  });
  await page.evaluate((serialized) => {
    localStorage.setItem("monitoring-business-data", serialized);
  }, scaledInventory);
  await page.reload({ waitUntil: "networkidle" });
  await page.goto("/#/beds", { waitUntil: "networkidle" });
  await expect(page.locator(".bed-list-header__count strong")).toHaveText("1000");
  expect(await page.locator('[data-testid="bed-card"]').count()).toBeLessThanOrEqual(12);
  await expect(page.locator(".el-pagination")).toBeVisible();

  const renderStartedAt = performance.now();
  await page.goto("/#/overview", { waitUntil: "networkidle" });
  const overviewDuration = performance.now() - renderStartedAt;
  expect(overviewDuration).toBeLessThan(5_000);
  expect(await page.locator(".bed-chip").count()).toBeLessThanOrEqual(400);

  await page.goto("/#/devices/cameras", { waitUntil: "networkidle" });
  await expect(page.locator(".camera-filters > span")).toContainText("1000");
  expect(await page.locator(".camera-table .el-table__row").count()).toBeLessThanOrEqual(12);
  await expect(page.locator(".camera-table-footer .el-pagination")).toBeVisible();
});

test("maintenance, camera, and staff pages do not overflow a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, "developer");

  for (const route of ["/#/admin/maintenance", "/#/devices/cameras", "/#/admin/staff"]) {
    await page.goto(route, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
