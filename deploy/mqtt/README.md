# MQTT Deployment

## Network

- Hotspot/ESP32 endpoint: `10.208.236.217:1883`
- VMware broker endpoint: `192.168.86.128:1883`
- MQTT WebSocket: `ws://10.208.236.217:8083/mqtt`

Windows port forwarding maps the hotspot address to the VMware EMQX instance.
Run `deploy/windows/setup-mqtt-forward.ps1` from an elevated PowerShell if the
forwarding rules need to be recreated.

## Accounts and ACLs

Passwords are provisioned directly in EMQX and must not be committed to this
repository.

| Account | Permission |
| --- | --- |
| `blanket-service` | Publish only to the assigned bed data topic |
| `blanket-device` | Internal collector; subscribe to all bed data topics |
| `blanket-publisher` | Test publisher; publish only to bed data topics |

`blanket-service` cannot subscribe to any topic. A device publishes one message
and finishes; EMQX does not send application data back to the publisher.

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

## Publish acknowledgement

- `QoS 0`: no return; best throughput and lowest latency.
- `QoS 1`: EMQX returns one empty standard `PUBACK` after accepting the message.
  This is the recommended simple acknowledgement when the device needs
  confirmation.
- The acknowledgement contains no application data, business JSON or added
  timestamp.
- `QoS 2` is unnecessary for this use case because it adds a second round trip.
