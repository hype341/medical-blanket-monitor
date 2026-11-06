import { describe, expect, it } from "vitest";
import {
  SENSOR_HEATMAP_COLUMNS,
  SENSOR_HEATMAP_ROWS,
  SENSOR_POINT_COUNT,
  buildSensorHeatmap,
  decodeSensorHex,
  getSensorPointPosition,
  scaleSensorPoint,
} from "./sensor-heatmap";

describe("sensor heatmap", () => {
  it("decodes exactly one byte per sensing point", () => {
    expect(SENSOR_HEATMAP_COLUMNS * SENSOR_HEATMAP_ROWS).toBe(SENSOR_POINT_COUNT);
    expect(decodeSensorHex("00,40,80,c0,ff")).toEqual([0, 64, 128, 192, 255]);
  });

  it("builds 64 columns from consecutive 28-point column groups", () => {
    const values = Array.from({ length: SENSOR_POINT_COUNT }, (_, index) => index % 256);
    const frame = buildSensorHeatmap(
      values.map((value) => value.toString(16).padStart(2, "0")).join(","),
    );

    expect(frame.complete).toBe(true);
    expect(frame.columns).toBe(64);
    expect(frame.rows).toBe(28);
    expect(frame.peakValue).toBe(255);
    expect(frame.pixels).toHaveLength(SENSOR_POINT_COUNT * 4);
    expect(frame.pixels[3]).toBe(255);
    expect(frame.pixels[(SENSOR_POINT_COUNT - 1) * 4 + 3]).toBe(255);
    const colors = new Set<string>();
    for (let index = 0; index < frame.pixels.length; index += 4) {
      colors.add(
        `${frame.pixels[index]},${frame.pixels[index + 1]},${frame.pixels[index + 2]}`,
      );
    }
    expect(colors.size).toBeGreaterThan(20);
  });

  it("marks incomplete frames instead of inventing sensor readings", () => {
    const frame = buildSensorHeatmap("ff,aa,07,07");

    expect(frame.complete).toBe(false);
    expect(frame.values).toEqual([255, 170, 7, 7]);
    expect(frame.pixels[4 * 4 + 3]).toBe(0);
  });

  it("uses white for minimum pressure and red for maximum pressure", () => {
    const frame = buildSensorHeatmap("00,ff");
    expect(frame.pixels[0]).toBeGreaterThan(235);
    expect(frame.pixels[1]).toBeGreaterThan(235);
    expect(frame.pixels[2]).toBeGreaterThan(235);
    expect(frame.pixels[64 * 4]).toBeGreaterThan(170);
    expect(frame.pixels[64 * 4 + 1]).toBeLessThan(80);
    expect(frame.pixels[64 * 4 + 2]).toBeLessThan(80);
  });

  it("maps every point linearly without enhancement", () => {
    expect([0, 1, 4, 100, 255].map(scaleSensorPoint)).toEqual([0, 1, 4, 100, 255]);
  });

  it("maps every 28-byte group to one top-to-bottom column", () => {
    expect(getSensorPointPosition(0)).toEqual({ row: 0, column: 0 });
    expect(getSensorPointPosition(1)).toEqual({ row: 1, column: 0 });
    expect(getSensorPointPosition(27)).toEqual({ row: 27, column: 0 });
    expect(getSensorPointPosition(28)).toEqual({ row: 0, column: 1 });
    expect(getSensorPointPosition(1791)).toEqual({ row: 27, column: 63 });
  });
});
