import { describe, expect, it } from "vitest";
import { applySensorFilter, type SensorFilterConfig } from "./sensor-filter";

const baseConfig: SensorFilterConfig = {
  type: "NONE",
  threshold: 0,
  windowSize: 3,
};

describe("sensor filter", () => {
  it("drops values below the threshold and excludes them from the mean", () => {
    const result = applySensorFilter([1, 5, 10, 20], {
      ...baseConfig,
      threshold: 10,
    });

    expect(result.values).toEqual([0, 0, 10, 20]);
    expect(result.activePoints).toBe(2);
    expect(result.droppedPoints).toBe(2);
    expect(result.filteredMean).toBe(15);
  });

  it("uses median filtering to remove an isolated spike", () => {
    const values = Array.from({ length: 28 * 64 }, () => 10);
    values[28 * 2 + 2] = 250;

    const result = applySensorFilter(values, {
      ...baseConfig,
      type: "MEDIAN",
      windowSize: 3,
    });

    expect(result.values[28 * 2 + 2]).toBe(10);
  });

  it("keeps a raw average alongside the filtered average", () => {
    const result = applySensorFilter([10, 20, 30], baseConfig);

    expect(result.rawMean).toBe(20);
    expect(result.filteredMean).toBe(20);
  });
});
