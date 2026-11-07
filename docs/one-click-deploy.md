# 医用智能毯平台一键部署说明

更新日期：2026-11-07

## 当前部署信息

| 项目 | 当前值 |
| --- | --- |
| GitHub 仓库 | https://github.com/hype341/medical-blanket-monitor |
| 本地项目目录 | D:\codex\blanket |
| 网站服务器 | h@172.20.10.12 |
| 摄像头节点 | lg@172.20.10.10 |
| 网站 | http://172.20.10.12/ |
| 网站目录 | /var/www/blanket |
| 部署私钥 | %USERPROFILE%\.ssh\blanket_deploy_ed25519 |
| 服务器发布命令 | /usr/local/bin/blanket-deploy |
| 自动备份目录 | /var/backups/blanket |

## 日常一键部署

在项目根目录双击 `deploy.cmd`，或执行：

```powershell
.\deploy.cmd
```

也可以直接运行 PowerShell 脚本：

脚本会依次完成：

1. TypeScript 类型检查。
2. 构建 Vue 生产静态文件。
3. 通过专用 SSH 密钥上传 dist。
4. 在服务器 /var/www/blanket 创建部署前备份。
5. 更新网站文件并修正 www-data 权限。
6. 执行 nginx -t 校验配置。
7. 校验失败时自动恢复上一版。
8. 校验成功后平滑重载 Nginx。

## 可选参数

只上传已经构建好的 dist，不重新构建：

```powershell
.\deploy.cmd -SkipBuild
```

部署到另一台同结构服务器：

```powershell
.\deploy.cmd `
  -ServerHost 172.20.10.200 `
  -ServerUser h `
  -KeyPath "$env:USERPROFILE\.ssh\blanket_deploy_ed25519"
```

## 当前已补充的服务器配置

- 已安装专用部署公钥，可无密码登录服务器。
- 已安装受限发布命令 /usr/local/bin/blanket-deploy。
- sudoers 只允许 h 用户免密执行该发布命令。
- 发布前自动备份，保留最近 10 份网站备份。
- 用户名、服务器密码和私钥均未写入 Git 仓库。

## 更换服务器时需要补什么

1. 将部署公钥加入服务器用户的 ~/.ssh/authorized_keys。
2. 将 deploy/server/blanket-deploy 上传并安装到 /usr/local/bin。
3. 创建受限 sudoers 配置。
4. 确认 /var/www/blanket、/var/backups/blanket 和 Nginx 服务存在。
5. 在本机确认专用私钥存在。

安装发布命令：

```bash
sudo install -o root -g root -m 755 /tmp/blanket-deploy /usr/local/bin/blanket-deploy
```

sudoers 内容：

```text
h ALL=(root) NOPASSWD: /usr/local/bin/blanket-deploy
```

检查 sudoers：

```bash
sudo visudo -cf /etc/sudoers.d/blanket-deploy
```

## 备份与回滚

每次部署前，服务器会生成：

```text
/var/backups/blanket/website-YYYYMMDD-HHMMSS.tar.gz
```

系统仅保留最近 10 份。需要人工回滚时，登录服务器执行：

```bash
sudo tar -C /var/www/blanket -xzf /var/backups/blanket/website-时间.tar.gz
sudo chown -R www-data:www-data /var/www/blanket
sudo nginx -t
sudo systemctl reload nginx
```

## 常见问题

### 提示缺少部署密钥

确认私钥位于：

```text
%USERPROFILE%\.ssh\blanket_deploy_ed25519
```

或通过 -KeyPath 指定其他私钥路径。

### Permission denied

说明服务器 authorized_keys 中没有对应公钥。使用服务器密码登录一次，将本机
blanket_deploy_ed25519.pub 的内容追加到目标用户的 authorized_keys。

### sudo 要求输入密码

检查 /etc/sudoers.d/blanket-deploy 是否存在，并确认内容只授权
/usr/local/bin/blanket-deploy。

### 类型检查或构建失败

脚本会在上传前停止，当前线上版本不会变化。先修复构建错误再重新执行。

### Nginx 校验失败

服务器会立即解压部署前备份、重新校验并重载 Nginx，然后返回失败状态。

## 部署后检查

```powershell
Invoke-WebRequest http://172.20.10.12/
Invoke-RestMethod http://172.20.10.12/api/health
```

网页应返回 HTTP 200，后端健康状态应为 UP，MQTT 应显示 connected。
