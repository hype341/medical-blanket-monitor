import { describe, expect, it } from "vitest";
import { buildRoomAlarmTopic, SENSOR_EVENT_TOPIC } from "./messaging";

describe("room MQTT topics", () => {
  it("creates an independent alarm topic for each hospital room", () => {
    expect(
      buildRoomAlarmTopic({
        hospitalCode: "H001",
        wardCode: "WARD-A",
        roomNo: "301",
      }),
    ).toBe("medical-blanket/v1/H001/WARD-A/301/alarm");
    expect(SENSOR_EVENT_TOPIC).toBe("medical-blanket/v1/+/+/+/sensor/+/telemetry");
  });
});
