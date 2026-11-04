export type AlarmLevel = "INFO" | "WARNING" | "CRITICAL";
export type AlarmStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface AlarmEnvelope {
  alarmId: string;
  code: string;
  level: AlarmLevel;
  status: AlarmStatus;
  title: string;
  detail: string;
  sensorKey: string;
  cameraKey: string;
  bedId: string;
  occurredAt: string;
  resolvedAt?: string;
}

export interface RecordingSegment {
  id: string;
  cameraKey: string;
  startAt: string;
  endAt: string;
  playbackUrl: string;
  thumbnailUrl?: string;
}

export interface ClipWindow {
  startAt: string;
  endAt: string;
}

export interface ClipWindowConfig {
  beforeSeconds: number;
  afterSeconds: number;
}

export interface RecordingTimelineSource {
  query(cameraKey: string, startAt: string, endAt: string): Promise<RecordingSegment[]>;
}

export interface RecordingClipService {
  requestClip(
    alarm: AlarmEnvelope,
    window: ClipWindow,
  ): Promise<{ clipId: string; status: "PENDING" | "READY" | "FAILED" }>;
}

const alarmLevels = new Set<AlarmLevel>(["INFO", "WARNING", "CRITICAL"]);

export function parseAlarmMessage(payload: string): AlarmEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  const requiredStrings = [
    "alarmId",
    "code",
    "title",
    "detail",
    "sensorKey",
    "cameraKey",
    "bedId",
    "occurredAt",
  ] as const;
  if (!requiredStrings.every((key) => typeof parsed[key] === "string")) return null;
  if (typeof parsed.level !== "string" || !alarmLevels.has(parsed.level as AlarmLevel)) return null;

  return {
    alarmId: parsed.alarmId as string,
    code: parsed.code as string,
    level: parsed.level as AlarmLevel,
    status:
      parsed.status === "ACKNOWLEDGED" || parsed.status === "RESOLVED" ? parsed.status : "OPEN",
    title: parsed.title as string,
    detail: parsed.detail as string,
    sensorKey: parsed.sensorKey as string,
    cameraKey: parsed.cameraKey as string,
    bedId: parsed.bedId as string,
    occurredAt: parsed.occurredAt as string,
  };
}

export function buildClipWindow(occurredAt: string, config: ClipWindowConfig): ClipWindow {
  const center = new Date(occurredAt).getTime();
  if (Number.isNaN(center)) throw new Error("Invalid alarm time");

  return {
    startAt: formatWithSourceOffset(new Date(center - config.beforeSeconds * 1000), occurredAt),
    endAt: formatWithSourceOffset(new Date(center + config.afterSeconds * 1000), occurredAt),
  };
}

export function findPlaybackSegment(
  segments: readonly RecordingSegment[],
  targetAt: string,
): RecordingSegment | null {
  const target = new Date(targetAt).getTime();
  return (
    segments.find(
      (segment) =>
        new Date(segment.startAt).getTime() <= target &&
        new Date(segment.endAt).getTime() >= target,
    ) ?? null
  );
}

export function pruneExpiredSegments(
  segments: readonly RecordingSegment[],
  nowAt: string,
  retentionMinutes: number,
): RecordingSegment[] {
  const cutoff = new Date(nowAt).getTime() - retentionMinutes * 60_000;
  return segments.filter((segment) => new Date(segment.startAt).getTime() >= cutoff);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatWithSourceOffset(date: Date, source: string): string {
  const match = source.match(/([+-])(\d{2}):(\d{2})$/);
  if (!match) return date.toISOString();

  const sign = match[1] === "+" ? 1 : -1;
  const offsetMinutes = sign * (Number(match[2]) * 60 + Number(match[3]));
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  const iso = local.toISOString().slice(0, 19);
  return `${iso}${match[1]}${match[2]}:${match[3]}`;
}
