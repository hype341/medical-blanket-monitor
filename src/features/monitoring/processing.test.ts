import { describe, expect, it } from "vitest";
import {
  normalizeHexData,
  parseSensorPayload,
  runSensorProcessors,
  runVideoFrameProcessors,
} from "./processing";

const reading = {
  messageId: "message-01",
  deviceKey: "blanket-001",
  observedAt: "2026-11-04T17:10:00+08:00",
  status: "ONLINE" as const,
  metrics: { motionState: "STILL" },
};

const frame = {
  cameraKey: "camera-01",
  capturedAt: "2026-11-04T17:10:00+08:00",
  payload: new Uint8Array([1, 2, 3]),
  format: "JPEG" as const,
};

describe("sensor processor extension point", () => {
  it("keeps only the data field in comma-separated hexadecimal form", () => {
    expect(normalizeHexData("0xFF 0xaa")).toBe("ff,aa");

    const readingWithHex = parseSensorPayload(
      JSON.stringify({
        ...reading,
        data: "0xFF, 0xAA",
      }),
    );
    expect(readingWithHex).toMatchObject({
      deviceKey: "blanket-001",
      status: "ONLINE",
      data: "ff,aa",
      metrics: { motionState: "STILL" },
    });
  });

  it("runs every registered processor against normalized telemetry", async () => {
    const findings = await runSensorProcessors(reading, [
      {
        id: "temperature-threshold",
        async analyze(input) {
          return input.metrics.motionState === "STILL"
            ? [{ code: "SENSOR_PROCESSED", severity: "INFO", title: "传感器数据处理完成" }]
            : [];
        },
      },
    ]);

    expect(findings.map((finding) => finding.code)).toEqual(["SENSOR_PROCESSED"]);
  });
});

describe("video processor extension point", () => {
  it("runs every registered processor against normalized frames", async () => {
    const findings = await runVideoFrameProcessors(frame, [
      {
        id: "frame-observer",
        async analyze(input) {
          return input.format === "JPEG"
            ? [{ code: "FRAME_PROCESSED", severity: "INFO", title: "画面处理完成" }]
            : [];
        },
      },
    ]);

    expect(findings.map((finding) => finding.code)).toEqual(["FRAME_PROCESSED"]);
  });
});
