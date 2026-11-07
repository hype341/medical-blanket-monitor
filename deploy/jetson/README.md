# Jetson 摄像头部署与服务器设置

## 两种服务器地址

`setvdserver` 的第一个参数是医用平台服务器地址，不是视频推流地址：

```bash
sudo setvdserver 172.20.10.12
```

它保存：

```text
PLATFORM_SERVER_HOST=172.20.10.12
PLATFORM_SERVER_PORT=80
```

当前架构中 MediaMTX 运行在摄像头本机，因此推流节点应保持
`MEDIAMTX_HOST=127.0.0.1`。如果把平台服务器 IP 误写成推流地址，摄像头将无法
在本机 MediaMTX 生成实时流。

查看完整配置：

```bash
sudo setvdserver --show
```

修改平台地址不会重启视频服务，也不会修改 MediaMTX 推流目标。

Windows 端执行 `deploy-camera.cmd` 时也会自动安装最新版 `setvdserver`，并把
`PLATFORM_SERVER_HOST` 设置为当前平台服务器地址。

配置文件：

```text
/etc/blanket/camera-stream.env
```

每次修改前会在同目录生成 `camera-stream.env.bak-日期-时间` 备份。

## 视频和内存维护

- HLS 使用标准 fMP4 分片，保证桌面浏览器持续刷新。
- Wi-Fi 连接自动连接并关闭网卡省电模式。
- 每 5 分钟清理临时文件、过期录像和过量日志。
- 可用内存低于 50% 时清理系统页缓存，不终止正在录像的进程。

## 重新安装摄像头服务

在 `deploy/jetson` 目录执行：

```bash
sudo ./install-with-docker.sh
```

安装脚本会保留已经存在的 `/etc/blanket/camera-stream.env`，不会覆盖当前平台
地址和本机推流配置。
