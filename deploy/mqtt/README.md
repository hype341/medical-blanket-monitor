# MQTT 部署

完整交接说明见 [MQTT 接入与交接](../../docs/deployment/mqtt.md)。

## Network

- Broker TCP: `mqtt://172.20.10.12:1883`
- WebSocket: `ws://172.20.10.12:8083/mqtt`
- Dashboard: `http://172.20.10.12:18083/`

Java 后端通过 `tcp://127.0.0.1:1883` 连接本机 EMQX。其他设备直接使用
`172.20.10.12:1883`，不再依赖 Windows 端口转发。

## Accounts and ACLs

The demo password is shown in the developer page for field testing. Production
deployments must provision independent credentials directly in EMQX and keep
those secrets outside this repository.

| Account | Permission |
| --- | --- |
| `blanket-service` | Publish to the assigned bed data topic; subscribe to server time only |
| `blanket-device` | Internal collector; subscribe to all bed data topics |
| `blanket-publisher` | Test publisher; publish only to bed data topics |

`blanket-service` cannot subscribe to bed data or alarm topics. A device
publishes one message and the platform assigns a unique bed data topic and alarm
topic whenever a bed is created.

## Data flow

1. The ESP32 publishes a JSON message to its assigned data topic.
2. `blanket-sensor-data.service` receives the message and keeps only the latest
   payload per bed.
3. The latest payload is written without an added timestamp or metadata.
4. Browsers and third-party consumers can read it from:

```text
http://172.20.10.12/api/public/sensors/{bedId}
```

File writes are coalesced every 100 ms so high-rate publishing does not block
MQTT intake.

## Server time

Devices may omit `observedAt`. The collector inserts the server receive time
before saving the latest payload.

Server time is also available from:

```text
HTTP: http://172.20.10.12/api/public/time
MQTT: medical-blanket/v1/system/time
```

The MQTT time topic is retained and refreshed every 5 seconds:

```json
{"unix":1762363200,"iso":"2026-11-05T20:00:00+08:00"}
```

## Publish acknowledgement

- `QoS 0`: no return; best throughput and lowest latency.
- `QoS 1`: EMQX returns one empty standard `PUBACK` after accepting the message.
  This is the recommended simple acknowledgement when the device needs
  confirmation.
- The acknowledgement contains no application data, business JSON or added
  timestamp.
- `QoS 2` is unnecessary for this use case because it adds a second round trip.

## Developer alarm downlink

`blanket-alarm-notify.service` exposes an internal HTTP endpoint through Nginx at
`POST /api/developer/notify`. The browser never receives the MQTT publishing
credential; the service uses the server-only publisher account and allows only
bed alarm topics under hospital `H001`.

The device subscribes to its own alarm topic and receives a notification:

```json
{
  "type": "notification",
  "alarmId": "developer-notify-1730000000000",
  "level": "WARNING",
  "title": "请检查当前床位毯子状态",
  "bedId": "bed-a-01",
  "occurredAt": "2026-11-05T21:00:00+08:00"
}
```

The sensor payload keeps normal JSON metadata. Only the `data` field is
explicitly hexadecimal, for example `"data": "ff,aa"`.
