import { describe, expect, it } from "vitest";
import {
  extractFullRawFrameHex,
  extractRawFrameSensorHex,
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

  it("derives hex data from the real pressure byte array", () => {
    const readingWithPressure = parseSensorPayload(
      JSON.stringify({
        ...reading,
        metrics: { pressure: [255, 170, 0] },
      }),
    );

    expect(readingWithPressure?.data).toBe("ff,aa,00");
    expect(readingWithPressure?.metrics.pressure).toEqual([255, 170, 0]);
  });

  it("derives hex data from the ESP32 rawFrame byte array", () => {
    const readingWithRawFrame = parseSensorPayload(
      JSON.stringify({
        ...reading,
        metrics: { rawFrame: [255, 170, 7] },
      }),
    );

    expect(readingWithRawFrame?.data).toBe("ff,aa,07");
    expect(readingWithRawFrame?.metrics.rawFrame).toEqual([255, 170, 7]);
  });

  it("extracts exactly 1792 sensor bytes from a complete 1799-byte frame", () => {
    const rawFrame = [
      255,
      170,
      7,
      7,
      1,
      1,
      ...Array.from({ length: 1792 }, (_, index) => index % 256),
      250,
    ];
    const extracted = extractRawFrameSensorHex(rawFrame).split(",");

    expect(rawFrame).toHaveLength(1799);
    expect(extracted).toHaveLength(1792);
    expect(extracted[0]).toBe("00");
    expect(extracted[1791]).toBe("ff");
    expect(extractFullRawFrameHex(rawFrame).split(",")).toHaveLength(1799);
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
