<div align="center">

# 医用智能毯安全监护平台

面向医院病区的智能毯传感器、床位告警和摄像头联动管理平台。

</div>

> 当前仓库为演示与原型版本，使用模拟患者数据和演示账号，不可直接作为生产医疗系统上线。正式使用前必须接入真实后端、数据库、MQTT Broker、身份认证、审计与医疗数据合规方案。

## 核心能力

- 安全总览：病区、病房、床位、传感器和视频设备统一查看。
- 床位监护：患者状态、毯子传感器图形、摄像头实时画面和录像回放。
- 时间回放：输入日期时间直接定位录像，告警可直接跳转到发生时刻。
- 告警处理：告警标红并弹出提示；护士标记已解决后变绿，再手动删除。
- 自动接入：每新增一张床位，自动生成毯子传感器、设备标识、数据主题和告警主题。
- 设备管理：设备绑定、毯子管理和摄像头管理统一放在可展开的设备管理分组。
- MQTT 主题：按床位独立的数据主题和告警主题，设备端可按四步接入并复制完整参数。
- 警告下行：开发者可以选择床位、级别和内容，通过服务器端 MQTT 通知设备。
- 传感器数据：每张床位独立接入，图形刷新率可配置。
- 十六进制数据：只有 `data` 字段按 `ff,aa` 格式展示，其他报文字段保持 JSON 原样。
- 视频接入：支持 WebRTC、HLS 和 RTSP，兼容 MediaMTX。
- 权限管理：系统管理员、护士、护士长和系统开发者分角色访问。
- 文档导出：MQTT 与视频接入文档支持预览、复制、Markdown 和 PDF 导出。

## 演示账号

所有演示账号密码均为 `123456`。

| 账号 | 角色 |
| --- | --- |
| `admin` | 系统管理员 |
| `nurse` | 值班护士 |
| `head-nurse` | 病区护士长 |
| `developer` | 系统开发者 |

## 技术栈

- Vue 3 + Vite + TypeScript
- Spring Boot 4.0.9 (Java 17)
- Element Plus
- Pinia + Vue Router
- HLS.js + flv.js
- MQTT.js

视频与物联网接入目标架构：

```text
摄像头 / 传感器
      │
      ├── RTSP / RTMP / SRT ──> MediaMTX ──> WebRTC / HLS
      │
      └── MQTT ──> EMQX ──> Java Spring Boot ──> MySQL / Redis
                                      │
                                      └── WebSocket ──> Vue 3 前端
```

## 本地运行

前端：

```bash
git clone https://github.com/hype341/medical-blanket-monitor.git
cd medical-blanket-monitor
npm install --global pnpm@10.34.5
pnpm install
pnpm run dev
```

访问 `http://localhost:3000`。

Spring Boot 后端：

```powershell
cd backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

后端默认监听 `127.0.0.1:8080`，健康检查为 `/api/health`，实时告警通过
`/ws/alarms` 推送。MQTT 订阅与下发凭据只放在服务器环境文件中。

## 主要页面

| 路径 | 功能 |
| --- | --- |
| `/overview` | 安全总览与模块入口 |
| `/beds` | 床位列表 |
| `/beds/:bedId` | 实时视频、回放、传感器图形与告警处理 |
| `/devices/bindings` | 床位、传感器和摄像头绑定 |
| `/devices/blankets` | 毯子名称与对应床位 |
| `/admin/management` | 病区、人员权限与录像策略 |
| `/admin/connections` | MQTT 数据主题、告警主题与在线文档 |
| `/devices/cameras` | 摄像头名称、床位和开发者视频直连地址 |
| `/admin/developer` | 开发者工作台、医院名称与告警联调 |

## 验证

```bash
pnpm test
pnpm test:e2e
pnpm build
```

## 说明

当前演示环境已连接 EMQX，设备可通过 MQTT 发布床位数据。演示地址和账号仅用于受控网络测试；公开网络使用前必须替换为独立设备账号、TLS 与访问控制。摄像头地址取决于本地网络和 MediaMTX 服务，公开网络访问需要额外的鉴权代理、TLS 和访问控制。

---

<details>
<summary>底层 vue3-element-admin 模板原始说明</summary>

<div align="center">

# <img alt="logo" width="40" valign="middle" src="./src/assets/images/logo.png"> vue3-element-admin

**Vue3 + Vite + TypeScript 企业级中后台前端**

[![Vue](https://img.shields.io/badge/Vue-3.5.30-brightgreen.svg)](https://vuejs.org/)
[![Element Plus](https://img.shields.io/badge/Element%20Plus-2.13.6-blue.svg)](https://element-plus.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Gitee Star](https://gitee.com/youlaiorg/vue3-element-admin/badge/star.svg)](https://gitee.com/youlaiorg/vue3-element-admin)
[![GitHub Star](https://img.shields.io/github/stars/youlaitech/vue3-element-admin?style=social)](https://github.com/youlaitech/vue3-element-admin)
[![GitCode Star](https://atomgit.com/youlai/vue3-element-admin/star/badge.svg)](https://gitcode.com/youlai/vue3-element-admin)
[![GitCode Star 2025](https://atomgit.com/youlai/vue3-element-admin/star/2025top.svg?style=flat-square&logoSize=14)](https://gitcode.com/youlai/vue3-element-admin)

</div>

<p align="center"><img src="./public/images/rainbow.png" alt="rainbow"></p>

<div align="center">

[![在线预览](https://img.shields.io/badge/在线预览-2D8CF0?style=for-the-badge&logo=google-chrome&logoColor=white)](https://vue.youlai.tech)
[![移动端预览](https://img.shields.io/badge/移动端预览-19BE6B?style=for-the-badge&logo=android&logoColor=white)](https://app.youlai.tech)
[![阅读文档](https://img.shields.io/badge/阅读文档-8B5CF6?style=for-the-badge&logo=gitbook&logoColor=white)](https://www.youlai.tech/docs/element/introduction.html)
[![官网](https://img.shields.io/badge/官网-FF9F1C?style=for-the-badge&logo=safari&logoColor=white)](https://www.youlai.tech)
[![English](https://img.shields.io/badge/English-00B4D8?style=for-the-badge&logo=google-translate&logoColor=white)](./README.en-US.md)

</div>

## 项目简介

[vue3-element-admin](https://gitcode.com/youlai/vue3-element-admin) 基于 Vue 3、Vite、TypeScript、Element Plus 构建的企业级中后台前端，配套 [9 种主后端 + 衍生版本](#生态矩阵)（覆盖 Java / Node.js / Go / Python / PHP / C# / Rust 7 种语言）及移动端 [youlai-app](https://gitee.com/youlaiorg/youlai-app)。其他前端版本：[JS 版](https://gitee.com/youlaiorg/vue3-element-admin-js) · [精简版](https://gitee.com/youlaiorg/vue3-element-template) · [NaiveUI 版](https://gitee.com/youlaiorg/vue3-naiveui-admin) · [Electron 桌面版](https://gitee.com/haoxr/youlai-electron)。

## 项目特色

- **简洁易用** — 基于 [vue-element-admin](https://gitee.com/panjiachen/vue-element-admin) 升级的 Vue3 版本，无过度封装，易上手
- **权限体系** — 动态路由、按钮权限、角色权限和数据权限
- **多租户** — 支持多租户模式与租户隔离
- **基础设施** — 国际化、多布局、暗黑模式、全屏、水印、接口文档、代码生成器
- **数据交互** — 支持 Mock 数据与线上接口文档，配套 Java / Node 后端源码
- **持续更新** — 项目持续开源更新，跟进主流技术栈

## 系统预览

**PC 端**

<table align="center">
  <tr>
    <td><img alt="PC预览1" width="400" src="./public/images/preview/pc-01.png"></td>
    <td><img alt="PC预览2" width="400" src="./public/images/preview/pc-02.png"></td>
  </tr>
  <tr>
    <td><img alt="PC预览3" width="400" src="./public/images/preview/pc-03.png"></td>
    <td><img alt="PC预览4" width="400" src="./public/images/preview/pc-04.png"></td>
  </tr>
  <tr>
    <td><img alt="PC预览5" width="400" src="./public/images/preview/pc-05.png"></td>
    <td><img alt="PC预览6" width="400" src="./public/images/preview/pc-06.png"></td>
  </tr>
</table>

**移动端**

<table align="center">
  <tr>
    <td><img alt="APP预览1" width="200" src="./public/images/preview/app-01.png"></td>
    <td><img alt="APP预览2" width="200" src="./public/images/preview/app-02.png"></td>
    <td><img alt="APP预览3" width="200" src="./public/images/preview/app-03.png"></td>
    <td><img alt="APP预览4" width="200" src="./public/images/preview/app-04.png"></td>
  </tr>
</table>

## 快速开始

**环境要求**：Node.js `^24.0.0` · pnpm `10.34.5`

| 环境类型 | 版本要求 | 备注 |
| -------- | -------- | ---- |
| **Node.js** | `^24.0.0` | 24 LTS；ESLint、lint-staged 等工具链要求 Node ≥ 22.22，统一到 24 |
| **包管理器** | `pnpm 10.34.5` | `packageManager` 字段已固定版本，请使用 Corepack 或同版本 pnpm |
| **开发工具** | [Visual Studio Code](https://code.visualstudio.com/Download) | 推荐安装 Vue、TypeScript 相关插件 |

```bash
# 克隆代码
git clone https://gitee.com/youlaiorg/vue3-element-admin.git
cd vue3-element-admin

# 安装 pnpm（已安装可跳过）
npm install --global pnpm@10.34.5

# 设置镜像源（可忽略）
pnpm config set registry https://registry.npmmirror.com

# 安装依赖
pnpm install

# 启动运行
pnpm run dev
```

启动后访问 [http://localhost:3000](http://localhost:3000)，使用 `admin` / `123456` 登录。

> 更多内容详见官方文档：[快速开始](https://www.youlai.tech/docs/element/quick-start.html) · [部署指南](https://www.youlai.tech/docs/element/deploy/)

## AI 编程

本项目配套 [Agent Skill](https://skills.sh/youlaitech/youlai-skills)，安装后 AI 编程助手会自动遵循本项目的 Vue3 开发规范（命名、目录结构、BEM + UnoCSS、组件与 API 约定）。支持 CodeBuddy、Claude Code、Cursor、Codex、GitHub Copilot 等 70+ Agent。

```bash
npx skills add https://github.com/youlaitech/youlai-skills --skill vue3-element-admin
```

## 生态矩阵

**前端**

| 项目 | 技术栈 | 说明 | 更新状态 |
|:-----|:-------|:-----|:---------|
| [vue3-element-admin](https://gitee.com/youlaiorg/vue3-element-admin) | Vue 3 + Vite + TS + Element Plus | PC 管理前端（主推） | ✅️ |
| [vue3-element-admin-js](https://gitee.com/youlaiorg/vue3-element-admin-js) | Vue 3 + Vite + JS + Element Plus | JavaScript 版本 | ✅️ |
| [vue3-element-template](https://gitee.com/youlaiorg/vue3-element-template) | Vue 3 + Vite + TS + Element Plus | 精简模板 | ✅️ |
| [vue3-naiveui-admin](https://gitee.com/youlaiorg/vue3-naiveui-admin) | Vue 3 + Vite + TS + Naive UI | Naive UI 版本 | ✅️ |
| [youlai-app](https://gitee.com/youlaiorg/youlai-app) | Vue 3 + UniApp | 移动端 App | ✅️ |
| [youlai-electron](https://gitee.com/haoxr/youlai-electron) | Electron + Vue 3 | 桌面版 | ✅️ |

**后端**

| 项目 | 技术栈 | 说明 | 更新状态 |
|:-----|:-------|:-----|:---------|
| [youlai-boot](https://gitee.com/youlaiorg/youlai-boot) | Spring Boot + MyBatis-Plus | Java（主推） | ✅️ |
| [youlai-nest](https://gitee.com/youlaiorg/youlai-nest) | NestJS + TypeORM | Node.js | ✅️ |
| [youlai-gin](https://gitee.com/youlaiorg/youlai-gin) | Go + Gorm | Go | ✅️ |
| [youlai-django](https://gitee.com/youlaiorg/youlai-django) | Django + DRF | Python | ✅️ |
| [youlai-fastapi](https://gitee.com/youlaiorg/youlai-fastapi) | FastAPI + SQLAlchemy | Python | ✅️ |
| [youlai-think](https://gitee.com/youlaiorg/youlai-think) | ThinkPHP + ThinkORM | PHP | ✅️ |
| [youlai-aspnet](https://gitee.com/youlaiorg/youlai-aspnet) | ASP.NET Core + EF Core | C# | ✅️ |
| [youlai-axum](https://gitee.com/youlaiorg/youlai-axum) | Axum + SeaORM | Rust | ✅️ |
| [youlai-laravel](https://gitee.com/youlaiorg/youlai-laravel) | Laravel + Eloquent | PHP | ✅️ |

> 九种后端共享同一套 **RESTful API 规范** 和 **数据库结构**，前端可无缝切换。

**衍生版本**

| 项目 | 基于 | 类型 | 说明 | 更新状态 |
|:-----|:-----|:-----|:-----|:---------|
| [youlai-boot-tenant](https://gitee.com/youlaiorg/youlai-boot-tenant) | youlai-boot | 独立仓库 | 多租户 SaaS，租户隔离与租户配置 | ✅️ |
| [youlai-nest (multi-tenant)](https://gitee.com/youlaiorg/youlai-nest/tree/multi-tenant) | youlai-nest | 分支 | 多租户 SaaS，租户隔离与租户配置 | ✅️ |
| [youlai-boot-flex](https://gitee.com/youlaiorg/youlai-boot-flex) | youlai-boot | 独立仓库 | 改用 MyBatis-Flex | ✅️ |
| [youlai-boot (db-pg)](https://gitee.com/youlaiorg/youlai-boot/tree/db-pg) | youlai-boot | 分支 | PostgreSQL 数据库分支 | ✅️ |
| [youlai-boot (multi-module)](https://gitee.com/youlaiorg/youlai-boot/tree/multi-module) | youlai-boot | 分支 | 多模块工程拆分 | ✅️ |
| [youlai-boot (spring-boot-3)](https://gitee.com/youlaiorg/youlai-boot/tree/spring-boot-3) | youlai-boot | 分支 | Spring Boot 3 兼容分支 | ✅️ |

## 开发指南

| 名称 | 地址 |
| -------- | -------- |
| 视频教程 | [https://www.bilibili.com/video/BV1eFUuYyEFj](https://www.bilibili.com/video/BV1eFUuYyEFj) |
| 项目搭建 | [基于 Vue3 + Vite + TypeScript + Element-Plus 从0到1搭建后台管理系统](https://blog.csdn.net/u013737132/article/details/130191394) |
| 官方文档 | [https://www.youlai.tech/docs/element/introduction.html](https://www.youlai.tech/docs/element/introduction.html) |
| 部署指南 | [https://www.youlai.tech/docs/element/deploy/](https://www.youlai.tech/docs/element/deploy/) |
| 常见问题 | [https://www.youlai.tech/docs/faq/](https://www.youlai.tech/docs/faq/) |
| 代码规范 | [ESLint V9 + Prettier + Stylelint + EditorConfig 约束和统一前端代码规范](https://youlai.blog.csdn.net/article/details/145608723) |
| 提交规范 | [Husky + Lint-staged + Commitlint + Commitizen + cz-git 配置 Git 提交规范](https://youlai.blog.csdn.net/article/details/145615236) |
| 接口文档 | [https://www.apifox.cn](https://www.apifox.cn/apidoc/shared-195e783f-4d85-4235-a038-eec696de4ea5) |

## 项目部署

当前本地服务器已经配置专用 SSH 部署密钥、受限发布命令和自动备份。直接双击
`deploy.cmd` 或在项目根目录执行：

```powershell
.\deploy.cmd
```

该命令会完成类型检查、生产构建、上传、备份、Nginx 校验和失败自动回滚。
只上传已构建文件、不重新构建：

```powershell
.\deploy.cmd -SkipBuild
```

部署说明见 [docs/one-click-deploy.md](docs/one-click-deploy.md)。

只生成构建文件时执行：

```bash
pnpm run build
```

## 数据接口

前端默认使用线上接口，也可切换为本地 Mock 或对接本地后端。

**本地 Mock**：将 `.env.development` 的 `VITE_MOCK_ENABLED` 设为 `true` 即启用本地 Mock 接口，无需后端即可独立开发。

**对接后端**：九种后端默认端口均为 `8000`，将 `.env.development` 的 `API_PROXY_TARGET` 改为 `http://localhost:8000` 并启动对应后端即可（主推 Java 后端 [youlai-boot](https://gitee.com/youlaiorg/youlai-boot.git)，其余见各自仓库 README）。

## 提交规范

执行 `pnpm run commit` 唤起 git commit 交互，根据提示完成信息的输入和选择。

![](https://foruda.gitee.com/images/1687755823165218215/c1705416_716974.png)

## 技术合作

本项目采用 [MIT](LICENSE) 协议开源，可免费商用。欢迎在 [Issue](https://gitee.com/youlaiorg/vue3-element-admin/issues) 提交问题或反馈，也欢迎提交 [Pull Request](https://gitee.com/youlaiorg/vue3-element-admin/pulls) 共建。如需技术支持、商务合作、二次开发或项目定制，可联系作者微信（见下方二维码）。

<table align="center">
  <tr>
    <td align="center">
      <img src="./public/images/qrcode/wechat-official.jpg" height="180" alt="公众号「有来技术」"><br>
      <sub>公众号「有来技术」</sub>
    </td>
    <td>&nbsp;&nbsp;&nbsp;&nbsp;</td>
    <td align="center">
      <img src="./public/images/qrcode/wechat-mp.jpg" height="180" alt="小程序「有来技术」"><br>
      <sub>小程序「有来技术」</sub>
    </td>
    <td>&nbsp;&nbsp;&nbsp;&nbsp;</td>
    <td align="center">
      <img src="./public/images/qrcode/wechat-personal.png" height="180" alt="添加作者微信"><br>
      <sub>添加作者微信</sub>
    </td>
  </tr>
</table>

<p align="center"><em>技术交流 · 问题反馈 · 商务合作</em></p>

</details>

