import {
  SENSOR_HEATMAP_COLUMNS,
  SENSOR_HEATMAP_ROWS,
  getSensorPointPosition,
} from "./sensor-heatmap";

export type SensorFilterType = "NONE" | "MEAN" | "MEDIAN" | "GAUSSIAN";

export interface SensorFilterConfig {
  type: SensorFilterType;
  threshold: number;
  windowSize: 3 | 5 | 7;
}

export interface SensorFilterResult {
  values: number[];
  rawMean: number;
  filteredMean: number;
  activePoints: number;
  droppedPoints: number;
  peakValue: number;
}

export const DEFAULT_SENSOR_FILTER_CONFIG: SensorFilterConfig = {
  type: "NONE",
  threshold: 0,
  windowSize: 3,
};

const SENSOR_FILTER_STORAGE_KEY = "monitoring-sensor-filter-config-v1";

export function loadSensorFilterConfig(): SensorFilterConfig {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SENSOR_FILTER_STORAGE_KEY) ?? "{}",
    ) as Partial<SensorFilterConfig>;
    const type =
      parsed.type === "MEAN" ||
      parsed.type === "MEDIAN" ||
      parsed.type === "GAUSSIAN"
        ? parsed.type
        : "NONE";
    return {
      type,
      threshold: Math.min(255, Math.max(0, Number(parsed.threshold) || 0)),
      windowSize:
        parsed.windowSize === 5 || parsed.windowSize === 7
          ? parsed.windowSize
          : 3,
    };
  } catch {
    return { ...DEFAULT_SENSOR_FILTER_CONFIG };
  }
}

export function saveSensorFilterConfig(config: SensorFilterConfig): void {
  window.localStorage.setItem(SENSOR_FILTER_STORAGE_KEY, JSON.stringify(config));
}

export function applySensorFilter(
  values: readonly number[],
  config: SensorFilterConfig,
): SensorFilterResult {
  const threshold = Math.min(255, Math.max(0, config.threshold));
  const grid = Array.from<number>({ length: SENSOR_HEATMAP_COLUMNS * SENSOR_HEATMAP_ROWS }).fill(0);
  const active = Array.from<boolean>({ length: grid.length }).fill(false);

  values.forEach((value, sourceIndex) => {
    if (sourceIndex >= grid.length) return;
    const normalized = Math.min(255, Math.max(0, Math.round(value)));
    const { row, column } = getSensorPointPosition(sourceIndex);
    const gridIndex = row * SENSOR_HEATMAP_COLUMNS + column;
    grid[gridIndex] = normalized;
    active[gridIndex] = normalized >= threshold;
  });

  const filtered = config.type === "NONE"
    ? grid.map((value, index) => (active[index] ? value : 0))
    : filterGrid(grid, active, config);
  const output = values.map((_, sourceIndex) => {
    const { row, column } = getSensorPointPosition(sourceIndex);
    return filtered[row * SENSOR_HEATMAP_COLUMNS + column] ?? 0;
  });
  const activeValues = output.filter((value) => value > 0);

  return {
    values: output,
    rawMean: mean(values),
    filteredMean: mean(activeValues),
    activePoints: activeValues.length,
    droppedPoints: Math.max(0, values.length - activeValues.length),
    peakValue: activeValues.length ? Math.max(...activeValues) : 0,
  };
}

function filterGrid(
  grid: readonly number[],
  active: readonly boolean[],
  config: SensorFilterConfig,
): number[] {
  const radius = Math.floor(config.windowSize / 2);
  const output = Array.from<number>({ length: grid.length }).fill(0);

  for (let row = 0; row < SENSOR_HEATMAP_ROWS; row += 1) {
    for (let column = 0; column < SENSOR_HEATMAP_COLUMNS; column += 1) {
      const index = row * SENSOR_HEATMAP_COLUMNS + column;
      if (!active[index]) continue;
      const samples: Array<{ value: number; weight: number }> = [];
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          const neighborRow = row + rowOffset;
          const neighborColumn = column + columnOffset;
          if (
            neighborRow < 0 ||
            neighborRow >= SENSOR_HEATMAP_ROWS ||
            neighborColumn < 0 ||
            neighborColumn >= SENSOR_HEATMAP_COLUMNS
          ) {
            continue;
          }
          const neighborIndex =
            neighborRow * SENSOR_HEATMAP_COLUMNS + neighborColumn;
          if (!active[neighborIndex]) continue;
          const distance = rowOffset ** 2 + columnOffset ** 2;
          samples.push({
            value: grid[neighborIndex],
            weight: Math.exp(-distance / Math.max(1, radius ** 2)),
          });
        }
      }
      if (!samples.length) continue;
      output[index] = Math.round(
        config.type === "MEDIAN"
          ? median(samples.map((sample) => sample.value))
          : weightedMean(samples, config.type === "GAUSSIAN"),
      );
    }
  }
  return output;
}

function weightedMean(
  samples: ReadonlyArray<{ value: number; weight: number }>,
  useWeights: boolean,
): number {
  const totalWeight = samples.reduce(
    (sum, sample) => sum + (useWeights ? sample.weight : 1),
    0,
  );
  const total = samples.reduce(
    (sum, sample) => sum + sample.value * (useWeights ? sample.weight : 1),
    0,
  );
  return totalWeight ? total / totalWeight : 0;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
