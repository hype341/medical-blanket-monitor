# 摄像头部署与运维

## 1. 当前摄像头

| 项目 | 内容 |
| --- | --- |
| 地址 | `172.20.10.10` |
| SSH 用户 | `lg` |
| 设备 | Jetson Nano |
| 摄像头 | IMX219 |
| 媒体路径 | `camera-01` |
| MediaMTX | Docker 容器 `mediamtx` |
| 推流服务 | `camera-stream.service` |

## 2. 一键发布

在项目根目录执行：

```powershell
.\deploy-camera.cmd
```

部署到另一台摄像头：

```powershell
.\deploy-camera.cmd -ServerHost 新摄像头IP -ServerUser lg
```

同时设置该摄像头对应的医用平台地址：

```powershell
.\deploy-camera.cmd `
  -ServerHost 新摄像头IP `
  -PlatformServerHost 新平台服务器IP
```

摄像头一键部署默认把平台地址设为 `http://172.20.10.12:80`，不会修改本机
MediaMTX 推流目标。

发布内容：

- GStreamer 采集和 H.264 编码脚本。
- 摄像头 systemd 服务。
- `setvdserver` 推流目标设置命令。
- MediaMTX 录像和 HLS 配置。
- 录像清理服务和定时器。
- 内存、临时文件和日志维护定时器。
- RTSP 健康检查脚本。

发布失败时，摄像头会自动恢复上一版配置文件并重启服务。

## 3. 首次安装部署密钥

本地生成无密码专用密钥。执行命令后，两次提示直接按 Enter：

```powershell
ssh-keygen -t ed25519 -C blanket-camera-deploy `
  -f "$env:USERPROFILE\.ssh\blanket_camera_deploy_ed25519"
```

把公钥加入摄像头：

```powershell
scp "$env:USERPROFILE\.ssh\blanket_camera_deploy_ed25519.pub" `
  lg@摄像头IP:/tmp/camera-deploy.pub
```

登录摄像头执行：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat /tmp/camera-deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

安装受限发布命令：

```bash
sudo install -o root -g root -m 755 \
  /tmp/blanket-camera-deploy \
  /usr/local/bin/blanket-camera-deploy
```

sudoers：

```text
lg ALL=(root) NOPASSWD: /usr/local/bin/blanket-camera-deploy
```

## 4. 修改医用平台服务器

摄像头终端执行：

```bash
sudo setvdserver 生产服务器IP
```

平台地址会保存为：

```text
PLATFORM_SERVER_HOST=生产服务器IP
PLATFORM_SERVER_PORT=80
```

视频推流节点始终由 `/etc/blanket/camera-stream.env` 中的
`MEDIAMTX_HOST` 控制。当前 MediaMTX 在摄像头本机，应保持：

```text
MEDIAMTX_HOST=127.0.0.1
MEDIAMTX_RTMP_PORT=1935
```

`setvdserver` 只修改医用平台服务地址，不会改动视频推流配置。

查看当前目标：

```bash
sudo setvdserver --show
```

配置保存在：

```text
/etc/blanket/camera-stream.env
```

## 5. 画质和网络

当前摄像头针对现有 Wi-Fi 使用：

```text
640x360 / 10fps / 300kbps
```

配置文件：

```text
/etc/blanket/camera-stream.env
```

主要参数：

```text
CAMERA_WIDTH=640
CAMERA_HEIGHT=360
CAMERA_FPS=10
CAMERA_BITRATE=300000
```

修改后重启：

```bash
sudo systemctl restart camera-stream.service
```

Wi-Fi 省电会明显增加延迟和丢帧。安装脚本会自动关闭省电模式；手工检查：

```bash
iw dev wlan0 get power_save
```

结果必须为 `off`。

## 6. MediaMTX

查看容器：

```bash
sudo docker ps
sudo docker logs --tail 100 mediamtx
sudo docker restart mediamtx
```

配置：

```text
/opt/mediamtx/mediamtx.yml
```

关键配置：

```text
hlsVariant: fmp4
hlsAlwaysRemux: true
record: true
playback: true
recordDeleteAfter: 24h
```

## 7. 视频地址

```text
HLS:
http://172.20.10.10:8888/camera-01/index.m3u8

WebRTC:
http://172.20.10.10:8889/camera-01

RTSP:
rtsp://172.20.10.10:8554/camera-01

回放索引:
http://172.20.10.10:9996/list?path=camera-01
```

## 8. 服务和日志

```bash
systemctl status camera-stream.service
journalctl -u camera-stream.service -f
systemctl status blanket-recordings-cleanup.timer
```

健康检查：

```bash
/usr/local/bin/blanket-camera-healthcheck camera-01
```

正常输出示例：

```text
camera healthcheck passed: camera-01, h264 640x360
```

## 9. 录像

录像目录：

```text
/var/lib/mediamtx/recordings/camera-01
```

录像保留时长不是固定 24 小时。维护脚本根据当前码率、剩余存储和录像大小动态
计算保留时长，最长 24 小时、最短 1 小时，并始终为系统预留约 15% 的磁盘空间。
空间不足时优先删除最旧的完整录像。

当前动态结果记录在：

```text
/var/lib/blanket-camera/retention-status
```

磁盘不足时，优先确认清理定时器：

```bash
systemctl status blanket-recordings-cleanup.timer
systemctl list-timers
```

长期部署建议把录像目录放到独立硬盘或 NAS，避免占满系统盘。

## 10. 内存维护

`blanket-camera-maintenance.timer` 每 5 分钟执行一次：

- 清理空录像、临时录像和超过 24 小时的过期录像。
- 将系统日志压缩到约 100MB。
- 可用内存低于 50% 时清理系统页缓存，恢复至少一半可用内存。
- 不强制结束正在录像或推流的进程。

检查：

```bash
systemctl status blanket-camera-maintenance.timer
journalctl -u blanket-camera-maintenance.service -n 50
```
