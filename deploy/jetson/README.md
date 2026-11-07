# Jetson 摄像头部署与推流目标

## 修改视频推送服务器

摄像头推流目标保存在：

```text
/etc/blanket/camera-stream.env
```

在摄像头终端执行：

```bash
sudo setvdserver 172.20.10.3
```

命令会校验服务器地址，保存配置，测试 RTMP 端口，然后重启
`camera-stream.service`。摄像头重启或服务器 IP 变更后，可以使用同一个命令重新设置。

同时修改 RTMP 端口和媒体路径：

```bash
sudo setvdserver 172.20.10.3 --port 1935 --path camera-01
```

查看当前目标：

```bash
sudo setvdserver --show
```

只保存配置，不立即重启：

```bash
sudo setvdserver monitor.example.com --no-restart
```

每次修改前会在同目录生成
`camera-stream.env.bak-日期-时间` 备份。服务器暂时不可连接时配置仍会保存，
摄像头服务会持续自动重连。

## 重新安装摄像头服务

在 `deploy/jetson` 目录执行：

```bash
sudo ./install-with-docker.sh
```

安装脚本会保留已经存在的 `/etc/blanket/camera-stream.env`，不会覆盖当前
推流服务器地址。
