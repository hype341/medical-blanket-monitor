# MQTT 接入与交接

## 1. 服务信息

| 项目 | 内容 |
| --- | --- |
| Broker | EMQX 5.8 |
| TCP 地址 | `mqtt://172.20.10.12:1883` |
| WebSocket | `ws://172.20.10.12:8083/mqtt` |
| Dashboard | http://172.20.10.12:18083/ |
| 安装目录 | `/opt/emqx` |
| Java 内部连接 | `tcp://127.0.0.1:1883` |

账号密码保存在 EMQX 和本地敏感清单中，不写入 GitHub。

## 2. 账号职责

| 账号 | 用途 |
| --- | --- |
| `blanket-service` | 单床设备发布数据、订阅本床告警和校时 |
| `blanket-device` | 后端或观察程序订阅数据 |
| `blanket-publisher` | 测试工具或告警通知发布，仅限授权 Topic |

生产环境必须做到“一床一设备一账号”，不能所有设备共用发布密码。

## 3. 主题格式

传感器数据：

```text
medical-blanket/v1/{医院}/{病区}/{病房-床位}/sensor/{设备标识}/data
```

示例：

```text
medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data
```

床位告警：

```text
medical-blanket/v1/{医院}/{病区}/{病房-床位}/alarm
```

示例：

```text
medical-blanket/v1/H001/WARD-A/301-01/alarm
```

系统时间：

```text
medical-blanket/v1/system/time
```

## 4. 传感器报文

正常 JSON 元数据保持不变，只有 `data` 字段使用十六进制：

```json
{
  "observedAt": "2026-11-07T14:00:00+08:00",
  "data": "ff,aa,07,07,..."
}
```

当前毯子数据为 28 点一列、64 列，共 1792 字节。平台会保留：

- 完整原始报文。
- 只包含 1792 字节数据区的十六进制接口。
- 后续处理接口，不会在采集入口强制滤波或丢点。

开放接口：

```text
http://172.20.10.12/api/public/sensors/bed-a-01
http://172.20.10.12/api/public/sensors/bed-a-01/hex
```

## 5. 告警报文

```json
{
  "alarmId": "alarm-20261107-001",
  "severity": "CRITICAL",
  "title": "301-01 床毯子异常",
  "occurredAt": "2026-11-07T14:00:00+08:00"
}
```

平台按 Topic 自动关联病区和床位。告警由护士处理后变为已解决，解决记录同步到
其他已登录页面；开发者可以下发测试警告。

## 6. QoS

- `QoS 0`：不等待设备确认，吞吐最高。
- `QoS 1`：EMQX 返回标准 PUBACK，建议用于正式设备。
- `QoS 2`：当前业务没有必要，增加额外往返延迟。

## 7. 测试连接

MQTTX 参数：

```text
Host: 172.20.10.12
Port: 1883
Topic: medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data
QoS: 1
```

浏览器或 WebSocket 测试：

```text
ws://172.20.10.12:8083/mqtt
```

## 8. 运维命令

EMQX 不在 systemd 中直接管理时，先确认进程：

```bash
ps -ef | grep emqx
ss -ltn | grep -E ':(1883|8083|18083) '
```

查看 EMQX 日志：

```bash
tail -f /opt/emqx/log/emqx.log
```

Java 后端连接状态：

```bash
curl -s http://127.0.0.1:8080/api/health
journalctl -u blanket-backend -f
```

## 9. 生产注意事项

- MQTT 公网部署必须启用 TLS，推荐端口 8883。
- 对每类设备设置独立用户名、密码和 Topic ACL。
- 必须限制发布通配符，禁止设备跨病区发布。
- EMQX Dashboard 只允许管理网络访问。
- 大规模设备接入时使用 EMQX 集群、共享订阅和数据库批量写入。
