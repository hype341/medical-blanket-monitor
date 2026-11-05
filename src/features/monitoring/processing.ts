import type { MetricValue, SensorMetrics, SensorStatus } from "./types";

export type FindingSeverity = "INFO" | "WARNING" | "CRITICAL";
export type VideoFrameFormat = "JPEG" | "PNG" | "YUV420" | "H264";

export interface SensorTelemetryEnvelope {
  messageId: string;
  deviceKey: string;
  bedId?: string;
  observedAt: string;
  status: SensorStatus;
  data?: string;
  metrics: SensorMetrics;
  batteryPercent?: number;
  signalStrength?: number;
}

export interface VideoFrameEnvelope {
  cameraKey: string;
  capturedAt: string;
  payload: Blob | ArrayBuffer | Uint8Array;
  format: VideoFrameFormat;
  metadata?: Record<string, MetricValue>;
}

export interface DataFinding {
  code: string;
  severity: FindingSeverity;
  title: string;
  detail?: string;
  bedId?: string;
  deviceKey?: string;
  metadata?: Record<string, MetricValue>;
}

export interface SensorDataProcessor {
  readonly id: string;
  analyze(reading: SensorTelemetryEnvelope): Promise<DataFinding[]> | DataFinding[];
}

export interface VideoFrameProcessor {
  readonly id: string;
  analyze(frame: VideoFrameEnvelope): Promise<DataFinding[]> | DataFinding[];
}

export interface SensorTelemetrySource {
  subscribe(handler: (reading: SensorTelemetryEnvelope) => void): () => void;
}

export interface CameraFrameSource {
  subscribe(handler: (frame: VideoFrameEnvelope) => void): () => void;
}

export interface SensorChartPoint {
  observedAt: string;
  value: number;
}

export interface SensorRenderConfig {
  refreshRateHz: number;
}

export function normalizeHexData(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  const compact = text.replace(/0x/gi, "").replace(/[\s,;:|_-]+/g, "");
  if (!compact || compact.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(compact)) {
    return text;
  }
  return compact.toLowerCase().match(/.{2}/g)?.join(",") ?? "";
}

export function parseSensorPayload(payload: string): SensorTelemetryEnvelope | null {
  try {
    const parsed = JSON.parse(payload) as SensorTelemetryEnvelope;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...parsed,
      ...(parsed.data === undefined ? {} : { data: normalizeHexData(parsed.data) }),
    };
  } catch {
    return null;
  }
}

export async function runSensorProcessors(
  reading: SensorTelemetryEnvelope,
  processors: readonly SensorDataProcessor[],
): Promise<DataFinding[]> {
  const results = await Promise.all(processors.map((processor) => processor.analyze(reading)));
  return results.flat();
}

export async function runVideoFrameProcessors(
  frame: VideoFrameEnvelope,
  processors: readonly VideoFrameProcessor[],
): Promise<DataFinding[]> {
  const results = await Promise.all(processors.map((processor) => processor.analyze(frame)));
  return results.flat();
}
