import { describe, expect, it } from "vitest";
import {
  buildBedDataTopic,
  buildBedAlarmTopic,
  buildMqttTopicUrl,
  buildSensorDataApiPath,
  LEGACY_SENSOR_EVENT_TOPIC,
  SENSOR_DATA_TOPIC,
} from "./messaging";

describe("room MQTT topics", () => {
  it("creates an independent alarm topic for each hospital room", () => {
    expect(
      buildBedAlarmTopic({
        hospitalCode: "H001",
        wardCode: "WARD-A",
        roomNo: "301",
        bedNo: "01",
      }),
    ).toBe("medical-blanket/v1/H001/WARD-A/301-01/alarm");
    expect(
      buildBedDataTopic({
        hospitalCode: "H001",
        wardCode: "WARD-A",
        roomNo: "301",
        bedNo: "01",
        deviceKey: "blanket-001",
      }),
    ).toBe("medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data");
    expect(SENSOR_DATA_TOPIC).toBe("medical-blanket/v1/+/+/+/sensor/+/data");
    expect(LEGACY_SENSOR_EVENT_TOPIC).toBe("medical-blanket/v1/+/+/+/sensor/+/telemetry");
    expect(buildSensorDataApiPath("bed-a-01")).toBe("/api/public/sensors/bed-a-01");
    expect(
      buildMqttTopicUrl(
        "mqtt://192.168.86.128:1883/",
        "medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data",
      ),
    ).toBe(
      "mqtt://192.168.86.128:1883/medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data",
    );
  });
});
