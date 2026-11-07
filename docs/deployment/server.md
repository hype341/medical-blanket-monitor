# 服务器部署与运维

## 1. 服务器信息

| 项目 | 内容 |
| --- | --- |
| 地址 | `172.20.10.12` |
| SSH 用户 | `h` |
| 操作系统 | Ubuntu 22.04 |
| Web 根目录 | `/var/www/blanket` |
| Java 后端 | `/opt/blanket/blanket-backend.jar` |
| 后端服务 | `blanket-backend.service` |
| 网关 | `nginx.service` |
| 回滚目录 | `/var/backups/blanket` |

## 2. 一键发布

在项目根目录执行：

```powershell
.\deploy-server.cmd
```

只上传已经构建好的前端和后端：

```powershell
.\deploy-server.cmd -SkipBuild
```

部署到新的服务器地址：

```powershell
.\deploy-server.cmd -ServerHost 新服务器IP -ServerUser h
```

脚本按以下顺序执行：

1. TypeScript 类型检查。
2. Vite 生产构建。
3. Java 后端测试和 JAR 打包。
4. 生成发布暂存目录。
5. 通过 SSH 专用密钥上传。
6. 服务器备份网站与后端。
7. 更新静态文件和 JAR。
8. 重启 Java 后端并执行 Nginx 校验。
9. 健康检查失败时自动恢复旧版。

## 3. 首次部署密钥

本地私钥：

```text
%USERPROFILE%\.ssh\blanket_deploy_ed25519
```

服务器需要把对应公钥加入 `h` 用户的
`~/.ssh/authorized_keys`，并安装：

```text
/usr/local/bin/blanket-deploy
```

sudoers 只应允许一条受限命令：

```text
h ALL=(root) NOPASSWD: /usr/local/bin/blanket-deploy
```

## 4. 主要服务

```bash
systemctl status nginx
systemctl status blanket-backend
systemctl status blanket-system-time
```

检查端口：

```bash
ss -ltn | grep -E ':(80|1883|8080|8083|18083) '
```

查看日志：

```bash
journalctl -u blanket-backend -f
journalctl -u blanket-system-time -f
tail -f /var/log/nginx/error.log
```

## 5. 健康检查

```bash
curl -s http://127.0.0.1:8080/api/health
curl -I http://127.0.0.1/
```

正常结果必须包含：

```json
{
  "status": "UP",
  "mqttConnected": true
}
```

## 6. Nginx

站点配置：

```text
/etc/nginx/sites-available/default
```

API 转发片段：

```text
/etc/nginx/snippets/blanket-sensor-data.conf
```

校验并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

当前 HTTP 环境使用：

```text
/api/       -> 127.0.0.1:8080
/ws/alarms  -> Java WebSocket
```

浏览器 MQTT 使用同一台服务器的 `8083/mqtt`。

## 7. 回滚

部署脚本会自动保留最近 10 份网站和后端备份。

人工恢复网站：

```bash
sudo tar -C /var/www/blanket -xzf /var/backups/blanket/website-时间.tar.gz
sudo chown -R www-data:www-data /var/www/blanket
sudo nginx -t
sudo systemctl reload nginx
```

人工恢复后端：

```bash
sudo install -o www-data -g www-data -m 644 \
  /var/backups/blanket/backend-时间.jar \
  /opt/blanket/blanket-backend.jar
sudo systemctl restart blanket-backend
```

## 8. 生产上线检查

- 使用 HTTPS 和真实域名。
- 修改 SSH、平台和 MQTT 默认密码。
- 使用防火墙限制 22、18083、3306 和 8080。
- 将 MySQL、业务数据和录像纳入备份。
- 摄像头数量增长后，将 MediaMTX 拆成独立流媒体集群。
- 万级设备场景下使用 EMQX 集群、消息队列和数据库批量写入。
