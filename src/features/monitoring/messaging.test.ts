import { describe, expect, it } from "vitest";
import { buildBedMqttTopics } from "./messaging";

describe("per-bed MQTT topics", () => {
  it("creates unique telemetry and alarm topics for a bed sensor", () => {
    expect(
      buildBedMqttTopics({
        hospitalCode: "H001",
        wardCode: "WARD-A",
        roomNo: "301",
        bedNo: "01",
        deviceKey: "blanket-001",
      }),
    ).toEqual({
      telemetry: "medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/telemetry",
      alarm: "medical-blanket/v1/H001/WARD-A/301/alarm",
    });
  });
});
