# 医用智能毯安全监护平台前端 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有视频测试页改造成可演示的医院智能毯监护前端 MVP，包含多摄像头、传感器数据、床位绑定和按病区访问的护士工作台。

**Architecture:** 在 vue3-element-admin 的 Layout 内增加一组产品静态路由，域模型与展示组件分离。业务数据先由 Mock 数据集和 Pinia store 提供，接口形态遵循 [平台设计](../../specs/2026-11-04-smart-blanket-monitoring-platform-design.md)，后续 Java API 可原位替换。

**Tech Stack:** Vue 3、Vite、TypeScript、Element Plus、Pinia、Vue Router、Vitest、hls.js、flv.js。

**Spec:** `docs/superpowers/specs/2026-11-04-smart-blanket-monitoring-platform-design.md`

## Global Constraints

- 产品名称固定为“医用智能毯安全监护平台”。
- 绑定粒度固定为床位。
- 一个床位允许绑定一个毯子传感器和多路摄像头。
- 护士权限按病区分配，页面筛选不能代替后端权限校验。
- 摄像头源凭证不得进入前端代码、Mock 数据或浏览器网络响应。
- 播放协议优先级固定为 WebRTC、HLS、HTTP-FLV。
- 当前没有真实摄像头流，空媒体地址必须显示明确的未接入状态。
- 新业务模块放在 `src/features/monitoring/`，通用播放器放在 `src/components/UniversalVideoPlayer/`。
- 所有生产函数先有失败测试，再写最小实现。
- 使用当前项目锁定的 pnpm 10.34.5。

---

### Task 1: 监护域模型与选择器

**Files:**

- Create: `src/features/monitoring/types.ts`
- Create: `src/features/monitoring/selectors.ts`
- Test: `src/features/monitoring/selectors.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: 无。
- Produces: `Bed`, `Camera`, `SensorDevice`, `SensorReading`, `CameraPlayback`, `BedMonitorSummary`
- Produces: `getBedMonitorSummary(bedId, data): BedMonitorSummary | null`
- Produces: `selectPlaybackProtocol(playback): "webrtc" | "hls" | "flv" | null`
- Produces: `filterBedSummaries(summaries, filters): BedMonitorSummary[]`

- [ ] **Step 1: 安装测试工具**

Run:

```powershell
corepack pnpm add -D vitest @playwright/test
```

Expected: `package.json` 和 `pnpm-lock.yaml` 增加 Vitest 与 Playwright Test。

测试配置把 `@` 解析到 `src`：

```ts
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: { environment: "node" },
});
```

- [ ] **Step 2: 写失败的选择器测试**

```ts
import { describe, expect, it } from "vitest";
import { getBedMonitorSummary, selectPlaybackProtocol } from "./selectors";

const data = {
  beds: [{ id: "bed-a", key: "bed-a" }],
  sensors: [{ id: "sensor-a", key: "sensor-a", bedId: "bed-a" }],
  cameras: [
    { id: "camera-main", key: "camera-main", bedId: "bed-a" },
    { id: "camera-side", key: "camera-side", bedId: "bed-a" },
  ],
  bindings: [
    { bedId: "bed-a", sensorDeviceId: "sensor-a", cameraId: null, role: "PRIMARY_SENSOR", status: "ACTIVE" },
    { bedId: "bed-a", sensorDeviceId: null, cameraId: "camera-main", role: "PRIMARY_CAMERA", status: "ACTIVE" },
    { bedId: "bed-a", sensorDeviceId: null, cameraId: "camera-side", role: "AUXILIARY_CAMERA", status: "ACTIVE" },
  ],
} as const;

describe("getBedMonitorSummary", () => {
  it("returns the active sensor and all active cameras for a bed", () => {
    const summary = getBedMonitorSummary("bed-a", data);

    expect(summary?.sensor?.key).toBe("sensor-a");
    expect(summary?.cameras.map((camera) => camera.key)).toEqual(["camera-main", "camera-side"]);
  });
});

describe("selectPlaybackProtocol", () => {
  it("prefers WebRTC over HLS and FLV", () => {
    expect(
      selectPlaybackProtocol({
        cameraId: "camera-a",
        preferredProtocol: "hls",
        webrtcUrl: "https://media.example/camera-a/whep",
        hlsUrl: "https://media.example/camera-a/index.m3u8",
        flvUrl: "https://media.example/camera-a.flv",
        expiresAt: "2026-11-04T17:00:00+08:00",
      }),
    ).toBe("webrtc");
  });
});
```

- [ ] **Step 3: 运行测试并确认失败**

Run:

```powershell
corepack pnpm exec vitest run src/features/monitoring/selectors.test.ts
```

Expected: FAIL，提示找不到 `selectors` 模块。

- [ ] **Step 4: 写最小类型和选择器实现**

类型至少包含：

```ts
export type CameraStatus = "ONLINE" | "OFFLINE" | "STALE";
export type SensorStatus = "ONLINE" | "OFFLINE" | "STALE" | "ALARM";
export type BindingRole = "PRIMARY_SENSOR" | "PRIMARY_CAMERA" | "AUXILIARY_CAMERA";
export type PlaybackProtocol = "webrtc" | "hls" | "flv";
```

`selectPlaybackProtocol` 固定按 WebRTC、HLS、FLV 的地址可用性选择。`getBedMonitorSummary` 只使用 `ACTIVE` 绑定。

- [ ] **Step 5: 运行测试并确认通过**

Run:

```powershell
corepack pnpm exec vitest run src/features/monitoring/selectors.test.ts
```

Expected: PASS。

### Task 2: 医院监护 Mock 数据和状态

**Files:**

- Create: `src/features/monitoring/mock-data.ts`
- Create: `src/features/monitoring/store.ts`
- Test: `src/features/monitoring/store.test.ts`

**Interfaces:**

- Consumes: Task 1 类型和选择器。
- Produces: `useMonitoringStore`
- Produces: `store.beds`, `store.cameras`, `store.sensors`, `store.bindings`
- Produces: `store.currentWardIds`
- Produces: `store.updateBinding(input)`

- [ ] **Step 1: 写失败的病区过滤和绑定更新测试**

```ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useMonitoringStore } from "./store";

describe("monitoring store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("only exposes beds from assigned wards", () => {
    const store = useMonitoringStore();
    expect(store.visibleBeds.every((bed) => store.currentWardIds.includes(bed.wardId))).toBe(true);
  });

  it("can replace a bed camera binding", () => {
    const store = useMonitoringStore();
    store.updateBinding({
      bedId: "bed-ward-a-01",
      sensorDeviceId: "sensor-a-01",
      cameraIds: ["camera-a-02"],
    });
    expect(store.getBedBindings("bed-ward-a-01").map((item) => item.cameraId)).toEqual([
      "camera-a-02",
    ]);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
corepack pnpm exec vitest run src/features/monitoring/store.test.ts
```

Expected: FAIL，提示找不到 `store` 模块。

- [ ] **Step 3: 写 Mock 数据**

数据不少于：

- 2 个病区。
- 4 间病房。
- 8 张床位。
- 8 个毯子传感器。
- 10 路摄像头，其中至少 2 张床位绑定多路摄像头。
- 在线、离线、数据陈旧和告警状态各至少一条。

- [ ] **Step 4: 写最小 Pinia store**

`visibleBeds` 按 `currentWardIds` 过滤。`updateBinding` 只结束目标床位的现有活跃绑定，然后创建新绑定，不影响其他床位。

- [ ] **Step 5: 运行测试并确认通过**

Run:

```powershell
corepack pnpm exec vitest run src/features/monitoring/store.test.ts
```

Expected: PASS。

### Task 3: 产品导航和品牌

**Files:**

- Modify: `src/router/index.ts`
- Modify: `src/router/guards.ts`
- Modify: `src/stores/permission.ts`
- Modify: `types/env.d.ts`
- Modify: `.env.development`
- Modify: `.env.production`
- Modify: `src/views/login/index.vue`
- Create: `src/layouts/Brand/index.vue` only if the existing logo component cannot read the title

**Interfaces:**

- Consumes: Task 2 页面组件路径。
- Produces: 静态产品路由 `/overview`, `/beds`, `/beds/:bedId`, `/monitor`, `/bindings`, `/devices/cameras`

- [ ] **Step 1: 写失败的路由契约检查**

在 `selectors.test.ts` 增加路由导入测试：

```ts
import router from "@/router";

it("registers hospital product routes", () => {
  expect(router.getRoutes().map((route) => route.path)).toEqual(
    expect.arrayContaining(["/overview", "/beds", "/beds/:bedId", "/monitor", "/bindings"]),
  );
});
```

Expected: FAIL，因为路由尚未注册。

- [ ] **Step 2: 注册路由并设置产品首页**

根路径重定向到 `/overview`。导航标题依次为“安全总览”“床位监护”“视频墙”“设备绑定”“摄像头管理”。

- [ ] **Step 3: 关闭模板动态演示菜单**

增加 `VITE_DYNAMIC_ROUTES_ENABLED`。开发和生产都设为 `false`，让当前产品菜单完全由静态产品路由提供；保留原代码路径供接入 Java 动态权限菜单时重新启用。

- [ ] **Step 4: 更新品牌文案**

浏览器标题、登录页主标题、侧边栏名称统一使用“医用智能毯安全监护平台”。登录默认账号改为 `admin`。

- [ ] **Step 5: 运行路由测试和类型检查**

Run:

```powershell
corepack pnpm exec vitest run src/features/monitoring/selectors.test.ts
corepack pnpm run type-check
```

Expected: 两条命令均退出码 0。

### Task 4: 安全总览与床位监护

**Files:**

- Create: `src/features/monitoring/views/OverviewView.vue`
- Create: `src/features/monitoring/views/BedListView.vue`
- Create: `src/features/monitoring/views/BedDetailView.vue`
- Create: `src/features/monitoring/components/BedStatusCard.vue`
- Create: `src/features/monitoring/components/SensorMetricCard.vue`
- Create: `playwright.config.ts`
- Create: `ui-monitoring.spec.ts`
- Test: `ui-monitoring.spec.ts`

**Interfaces:**

- Consumes: `useMonitoringStore`。
- Produces: 安全总览统计和床位卡片。
- Produces: `/beds/:bedId` 床位详情。

- [ ] **Step 1: 写失败的浏览器流程测试**

Playwright 流程：

```ts
async function loginAsAdmin(page: Page) {
  await page.goto("/#/beds");
  await page.locator('input[placeholder="用户名"]').fill("admin");
  await page.locator('input[placeholder="密码"]').fill("123456");
  await page.locator('input[placeholder="验证码"]').fill("1");
  await page.locator(".login-card__submit").click();
  await page.waitForURL("**/#/beds");
}

await loginAsAdmin(page);
await expect(page.getByRole("heading", { name: "安全总览" })).toBeVisible();
await page.getByText("床位监护").first().click();
await expect(page.getByText("A 病区").first()).toBeVisible();
await page.locator('[data-testid="bed-card"]').first().click();
await expect(page.getByText("毯面温度").first()).toBeVisible();
```

Expected: FAIL，因为页面尚不存在。

Playwright 配置使用本机 Chrome：

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "ui-monitoring.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:3000",
    channel: "chrome",
    headless: true,
  },
  projects: [{ name: "chromium" }],
});
```

- [ ] **Step 2: 实现总览**

总览显示：监测床位数、在线传感器数、视频在线数、异常/离线数、病区状态和最近告警。

- [ ] **Step 3: 实现床位列表**

按病区、病房和状态筛选。每张卡片显示病房床位、传感器状态、关键指标和已绑定摄像头数量。

- [ ] **Step 4: 实现床位详情**

详情左右分栏：左侧视频区域，右侧传感器指标和趋势。窄屏改为上下布局。未接入视频显示“摄像头待接入”，不显示虚构画面。

- [ ] **Step 5: 运行浏览器测试**

Run:

```powershell
corepack pnpm exec playwright test ui-monitoring.spec.ts --project=chromium
```

Expected: PASS。

### Task 5: 通用播放器与视频墙

**Files:**

- Create: `src/components/UniversalVideoPlayer/index.vue`
- Create: `src/components/UniversalVideoPlayer/usePlayback.ts`
- Create: `src/features/monitoring/views/VideoWallView.vue`
- Create: `src/features/monitoring/views/CameraListView.vue`
- Test: `src/components/UniversalVideoPlayer/protocol.test.ts`
- Test: `ui-monitoring.spec.ts`

**Interfaces:**

- Consumes: `CameraPlayback`。
- Produces: `<UniversalVideoPlayer :camera="camera" :playback="playback" />`
- Produces: `getPlaybackCandidates(playback): PlaybackCandidate[]`

- [ ] **Step 1: 安装媒体依赖**

Run:

```powershell
corepack pnpm add hls.js flv.js
```

Expected: 两个依赖出现在 `dependencies`。

- [ ] **Step 2: 写失败的协议候选测试**

```ts
it("returns protocols in WebRTC, HLS, FLV order", () => {
  expect(getPlaybackCandidates(fullPlayback).map((item) => item.protocol)).toEqual([
    "webrtc",
    "hls",
    "flv",
  ]);
});

it("omits protocols without a URL", () => {
  expect(getPlaybackCandidates(hlsOnlyPlayback).map((item) => item.protocol)).toEqual(["hls"]);
});
```

Expected: FAIL，因为 `usePlayback` 尚不存在。

- [ ] **Step 3: 实现播放器**

WebRTC 使用 WHEP；HLS 动态导入 `hls.js`；FLV 动态导入 `flv.js`。协议失败时切换下一候选，全部失败则显示离线状态和重试按钮。组件卸载时释放播放器和媒体连接。

- [ ] **Step 4: 实现视频墙**

视频墙按病房筛选，支持 1/4/9 宫格。每路卡片显示摄像头名称、病区病房床位、协议和状态。空地址显示待接入。

- [ ] **Step 5: 运行协议测试和浏览器测试**

Run:

```powershell
corepack pnpm exec vitest run src/components/UniversalVideoPlayer/protocol.test.ts
corepack pnpm exec playwright test ui-monitoring.spec.ts --project=chromium
```

Expected: PASS。

### Task 6: 设备绑定

**Files:**

- Create: `src/features/monitoring/views/BindingsView.vue`
- Create: `src/features/monitoring/components/BindingEditor.vue`
- Test: `src/features/monitoring/store.test.ts`
- Test: `ui-monitoring.spec.ts`

**Interfaces:**

- Consumes: `store.updateBinding(input)`。
- Produces: 按床位查看和修改传感器、主摄像头、辅助摄像头。

- [ ] **Step 1: 写失败的绑定成功提示测试**

```ts
await page.getByText("设备绑定").first().click();
await page.getByRole("button", { name: "编辑绑定" }).first().click();
await page.getByRole("button", { name: "保存绑定" }).click();
await expect(page.getByText("绑定已保存")).toBeVisible();
```

Expected: FAIL，因为绑定页尚不存在。

- [ ] **Step 2: 实现绑定列表**

按病房床位显示传感器、主摄像头和辅助摄像头。没有绑定时显示“未绑定”。

- [ ] **Step 3: 实现绑定编辑**

每个床位选择传感器、主摄像头和辅助摄像头。保存前检查主摄像头不能与辅助摄像头重复。

- [ ] **Step 4: 运行 store 和浏览器测试**

Run:

```powershell
corepack pnpm exec vitest run src/features/monitoring/store.test.ts
corepack pnpm exec playwright test ui-monitoring.spec.ts --project=chromium
```

Expected: PASS。

### Task 7: 全量验证与部署

**Files:**

- Modify: `deploy/nginx-site.conf`
- Verify: `dist/`

**Interfaces:**

- Consumes: 已完成前端页面。
- Produces: Nginx 可部署的医院监护前端。

- [ ] **Step 1: 运行完整静态检查**

Run:

```powershell
corepack pnpm run check
```

Expected: 退出码 0。

- [ ] **Step 2: 运行完整单元测试**

Run:

```powershell
corepack pnpm exec vitest run
```

Expected: 0 failures。

- [ ] **Step 3: 构建生产包**

Run:

```powershell
corepack pnpm run build
```

Expected: 退出码 0。

- [ ] **Step 4: 启动 Mock 开发服务并执行 Playwright**

Run:

```powershell
corepack pnpm run dev
corepack pnpm exec playwright test ui-monitoring.spec.ts --project=chromium
```

Expected: 登录、总览、床位详情、视频墙和绑定流程全部通过。

- [ ] **Step 5: 部署到 `192.168.86.128`**

Run:

```powershell
tar -czf blanket-dist-final.tar.gz -C D:\codex\blanket dist
scp blanket-dist-final.tar.gz h@192.168.86.128:/tmp/
ssh h@192.168.86.128

# 以下在服务器 root 会话中执行
mkdir -p /var/www/blanket-next
tar -xzf /tmp/blanket-dist-final.tar.gz -C /var/www/blanket-next --strip-components=1
chown -R www-data:www-data /var/www/blanket-next
mv /var/www/blanket /var/www/blanket.previous
mv /var/www/blanket-next /var/www/blanket
nginx -t
systemctl reload nginx
```

Expected: 首页 HTTP 200，静态资源 HTTP 200，Nginx 配置测试成功。

- [ ] **Step 6: 检查最终变更**

Run:

```powershell
git -c safe.directory=D:/codex/blanket diff --check
git -c safe.directory=D:/codex/blanket status --short
```

Expected: 无空白错误，变更仅包含本轮产品代码、测试、配置和部署文件。
