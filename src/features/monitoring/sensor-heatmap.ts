export const SENSOR_HEATMAP_COLUMNS = 64;
export const SENSOR_HEATMAP_ROWS = 28;
export const SENSOR_POINT_COUNT = SENSOR_HEATMAP_COLUMNS * SENSOR_HEATMAP_ROWS;

export interface SensorHeatmapFrame {
  columns: number;
  rows: number;
  values: number[];
  pixels: Uint8ClampedArray;
  complete: boolean;
  peakValue: number;
}

const COLOR_STOPS = [
  { value: 0, color: [248, 250, 249] },
  { value: 64, color: [255, 238, 199] },
  { value: 128, color: [255, 204, 102] },
  { value: 192, color: [244, 145, 55] },
  { value: 224, color: [224, 77, 45] },
  { value: 255, color: [194, 36, 34] },
] as const;

export function decodeSensorHex(hexData: string | null | undefined): number[] {
  if (!hexData?.trim()) return [];
  return hexData
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number.parseInt(value, 16))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.min(255, Math.max(0, value)));
}

export function buildSensorHeatmap(
  hexData: string | null | undefined,
  columns = SENSOR_HEATMAP_COLUMNS,
  rows = SENSOR_HEATMAP_ROWS,
): SensorHeatmapFrame {
  const values = decodeSensorHex(hexData).slice(0, columns * rows);
  const pixels = new Uint8ClampedArray(columns * rows * 4);
  const peakValue = Math.max(0, ...values);

  values.forEach((value, index) => {
    const displayValue =
      peakValue > 0 ? Math.round((value / peakValue) ** 0.22 * 255) : 0;
    const [red, green, blue] = sensorValueColor(displayValue);
    const offset = index * 4;
    pixels[offset] = red;
    pixels[offset + 1] = green;
    pixels[offset + 2] = blue;
    pixels[offset + 3] = 255;
  });

  return {
    columns,
    rows,
    values,
    pixels,
    complete: values.length === SENSOR_POINT_COUNT,
    peakValue,
  };
}

function sensorValueColor(value: number): readonly [number, number, number] {
  const normalized = Math.min(255, Math.max(0, value));
  for (let index = 1; index < COLOR_STOPS.length; index += 1) {
    const previous = COLOR_STOPS[index - 1];
    const next = COLOR_STOPS[index];
    if (normalized > next.value) continue;
    const ratio = (normalized - previous.value) / (next.value - previous.value);
    return [
      Math.round(previous.color[0] + (next.color[0] - previous.color[0]) * ratio),
      Math.round(previous.color[1] + (next.color[1] - previous.color[1]) * ratio),
      Math.round(previous.color[2] + (next.color[2] - previous.color[2]) * ratio),
    ];
  }
  return COLOR_STOPS.at(-1)!.color;
}
