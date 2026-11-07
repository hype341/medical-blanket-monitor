# 医用智能毯平台交接文档

更新日期：2026-11-07

本文档面向项目负责人、医院信息科、开发人员和运维人员。账号密码不在本仓库保存，
敏感清单单独放在本地 `private/` 目录，禁止提交到 GitHub。

## 1. 系统地址

| 组件 | 当前地址 | 说明 |
| --- | --- | --- |
| 平台网页 | http://172.20.10.12/ | 前端、API 和 MQTT 所在服务器 |
| 摄像头节点 | `172.20.10.10` | Jetson Nano + MediaMTX |
| MQTT TCP | `mqtt://172.20.10.12:1883` | ESP32 或外部设备接入 |
| MQTT WebSocket | `ws://172.20.10.12:8083/mqtt` | 浏览器实时订阅 |
| EMQX Dashboard | http://172.20.10.12:18083/ | 生产环境建议限制访问来源 |
| 摄像头 HLS | http://172.20.10.10:8888/camera-01/index.m3u8 | 浏览器兼容线路 |
| 摄像头 WebRTC | http://172.20.10.10:8889/camera-01 | 低延迟线路 |
| 摄像头回放 API | http://172.20.10.10:9996/ | MediaMTX 录像索引 |
| GitHub | https://github.com/hype341/medical-blanket-monitor | 源码和部署脚本 |

服务器 IP 变化时，网页 MQTT 地址会自动取当前网页地址；摄像头默认节点的修改和
多摄像头单独配置见 [摄像头交接文档](deployment/camera.md)。

## 2. 一键部署入口

在项目根目录执行：

| 场景 | 命令 |
| --- | --- |
| 只发布网页和 Java 后端 | `deploy-server.cmd` |
| 只发布摄像头脚本和 MediaMTX 配置 | `deploy-camera.cmd` |
| 同时发布服务器和摄像头 | `deploy-all.cmd` |

服务器发布包含 TypeScript 检查、前端构建、后端测试与打包、上传、备份、Nginx
校验和健康检查。摄像头发布包含上传、备份、安装服务、更新 MediaMTX、重启和
RTSP 视频轨道检查，失败会自动恢复上一版。

首次把项目放到一台新 Windows 电脑时，需要先准备两个部署密钥：

```text
%USERPROFILE%\.ssh\blanket_deploy_ed25519
%USERPROFILE%\.ssh\blanket_camera_deploy_ed25519
```

密钥安装步骤见对应专题文档。私钥不得提交到 GitHub。

## 3. 核心组件

```text
浏览器
  ├─ Vue 3 前端
  ├─ Java Spring Boot API
  ├─ EMQX MQTT
  └─ MediaMTX 摄像头流

ESP32 / 毯子传感器
  └─ MQTT 数据与告警

Jetson Nano
  ├─ IMX219 摄像头采集
  ├─ GStreamer H.264 编码
  └─ MediaMTX 实时流、录像和回放
```

## 4. 交接文档索引

- [服务器部署与运维](deployment/server.md)
- [摄像头部署与运维](deployment/camera.md)
- [MQTT 接入与主题](deployment/mqtt.md)
- [原有服务器部署说明](one-click-deploy.md)
- [MQTT 部署脚本说明](../deploy/mqtt/README.md)

## 5. 当前演示账号

平台内置账号均为 `admin`、`nurse`、`head-nurse`、`developer`。密码和 SSH、
EMQX 凭据不在 Git 仓库中，详见本地 `private/服务器账号与访问地址清单.md`。

生产上线前必须：

1. 修改全部默认密码。
2. 为每台设备分配独立 MQTT 账号和最小 Topic 权限。
3. 禁止把 MySQL、Redis、EMQX Dashboard 直接暴露到公网。
4. 将系统从演示 HTTP 切换为 HTTPS。
5. 建立数据库、业务数据、摄像头录像和 MQTT 凭据的独立备份。

## 6. 快速验收

```powershell
Invoke-RestMethod http://172.20.10.12/api/health
Invoke-WebRequest http://172.20.10.12/
Test-NetConnection 172.20.10.10 -Port 8888
Test-NetConnection 172.20.10.10 -Port 9996
Test-NetConnection 172.20.10.12 -Port 1883
```

后端健康结果应包含：

```text
status: UP
mqttConnected: true
```

平台页面的床旁视频必须持续更新，不能只显示“摄像头在线”但画面时间不前进。

## 7. 网络发生变化时

| 变化 | 操作 |
| --- | --- |
| 网站服务器 IP 变化 | 使用 `deploy-server.cmd -ServerHost 新IP`，网页地址自动跟随 |
| 摄像头节点 IP 变化 | 使用 `deploy-camera.cmd -ServerHost 新IP`，并在摄像头管理页更新设备地址 |
| 医用平台服务器 IP 变化 | 摄像头执行 `sudo setvdserver 新平台IP` |
| 视频推流节点变化 | 编辑摄像头 `/etc/blanket/camera-stream.env` 并重启 `camera-stream` |
| Wi-Fi 名称变化 | 摄像头重新连接 Wi-Fi，并执行安装脚本关闭网卡省电模式 |
| 生产域名启用 | 配置 HTTPS、WSS，并把 MediaMTX 播放地址改为 HTTPS 域名 |
| 摄像头内存维护 | 每 5 分钟检查，可用内存低于 50% 时自动回收页缓存 |

## 8. 重要目录

服务器：

```text
/var/www/blanket                       前端静态文件
/opt/blanket/blanket-backend.jar       Java 后端
/etc/blanket                           后端和摄像头环境配置
/var/backups/blanket                   网站与后端回滚备份
```

摄像头：

```text
/etc/blanket/camera-stream.env         摄像头和推流目标配置
/opt/mediamtx/mediamtx.yml             MediaMTX 配置
/var/lib/mediamtx/recordings           摄像头录像
/var/backups/blanket-camera            摄像头回滚备份
/usr/local/bin/setvdserver             推流服务器设置命令
```
