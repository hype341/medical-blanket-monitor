# MQTT Deployment

## Network

- Hotspot/ESP32 endpoint: `10.208.236.217:1883`
- VMware broker endpoint: `192.168.86.128:1883`
- MQTT WebSocket: `ws://10.208.236.217:8083/mqtt`

Windows port forwarding maps the hotspot address to the VMware EMQX instance.
Run `deploy/windows/setup-mqtt-forward.ps1` from an elevated PowerShell if the
forwarding rules need to be recreated.

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
http://10.208.236.217/api/public/sensors/{bedId}
```

File writes are coalesced every 100 ms so high-rate publishing does not block
MQTT intake.

## Server time

Devices may omit `observedAt`. The collector inserts the server receive time
before saving the latest payload.

Server time is also available from:

```text
HTTP: http://10.208.236.217/api/public/time
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
