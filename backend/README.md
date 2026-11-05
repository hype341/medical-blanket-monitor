# Spring Boot Backend

This service owns the production MQTT and public API integration for the
medical blanket platform.

## APIs

- `GET /api/health`
- `GET /api/public/time`
- `GET /api/public/sensors`
- `GET /api/public/sensors/{bedId}`
- `GET /api/public/sensors/{bedId}/processed`
- `GET /api/public/alarms`
- `POST /api/developer/notify`
- `WS /ws/alarms`

Only the `data` field is normalized as comma-separated hexadecimal values.
All other JSON fields remain unchanged.

## Sensor processing extension

Create a Spring bean implementing
`com.medicalblanket.processing.SensorPayloadProcessor`. Each processor receives
the bed ID and a copy of the normalized raw payload, and returns an `ObjectNode`.
Processed values are exposed separately under `/processed` so the raw MQTT
payload is never overwritten.

## Build

```powershell
.\mvnw.cmd test
.\mvnw.cmd package
```
