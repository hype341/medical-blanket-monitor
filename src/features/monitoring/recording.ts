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
  wardId: string;
  roomId: string;
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
  contentOffsetSeconds?: number;
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

export interface MediaMtxPlaybackItem {
  start: string;
  duration: number;
  url: string;
}

export interface ResolvedPlaybackSource {
  playbackUrl: string;
  timelineStartAt: string;
  videoOffsetSeconds: number;
  targetVideoSeconds: number;
}

export function mapMediaMtxPlaybackItems(
  items: MediaMtxPlaybackItem[],
  cameraKey: string,
  playbackOrigin: string,
): RecordingSegment[] {
  const mapped = items.map((item, index) => {
    const startMs = new Date(item.start).getTime();
    return {
      id: `${cameraKey}-${startMs}-${index}`,
      cameraKey,
      startAt: item.start,
      endAt: new Date(startMs + item.duration * 1000).toISOString(),
      playbackUrl: item.url.replace(/^https?:\/\/[^/]+/, playbackOrigin),
    };
  });
  return normalizePlaybackSegments(mapped);
}

export function normalizePlaybackSegments(
  segments: readonly RecordingSegment[],
): RecordingSegment[] {
  const sorted = [...segments].sort(
    (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  );
  const normalized: RecordingSegment[] = [];
  for (const segment of sorted) {
    const last = normalized.at(-1);
    const start = new Date(segment.startAt).getTime();
    const end = new Date(segment.endAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    if (!last) {
      normalized.push({ ...segment });
      continue;
    }

    const lastEnd = new Date(last.endAt).getTime();
    if (start >= lastEnd) {
      normalized.push({ ...segment });
      continue;
    }
    if (end <= lastEnd) continue;

    normalized.push({
      ...segment,
      startAt: new Date(lastEnd).toISOString(),
      contentOffsetSeconds: (lastEnd - start) / 1000,
    });
  }
  return normalized;
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
  const requiredStrings = ["alarmId", "title", "bedId", "occurredAt"] as const;
  if (!requiredStrings.every((key) => typeof parsed[key] === "string")) return null;
  if (typeof parsed.level !== "string" || !alarmLevels.has(parsed.level as AlarmLevel)) return null;

  return {
    alarmId: parsed.alarmId as string,
    code: typeof parsed.code === "string" ? parsed.code : "BED_ALARM",
    level: parsed.level as AlarmLevel,
    status:
      parsed.status === "ACKNOWLEDGED" || parsed.status === "RESOLVED" ? parsed.status : "OPEN",
    title: parsed.title as string,
    detail: typeof parsed.detail === "string" ? parsed.detail : (parsed.title as string),
    sensorKey: typeof parsed.sensorKey === "string" ? parsed.sensorKey : "",
    cameraKey: typeof parsed.cameraKey === "string" ? parsed.cameraKey : "",
    wardId: typeof parsed.wardId === "string" ? parsed.wardId : "",
    roomId: typeof parsed.roomId === "string" ? parsed.roomId : "",
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
  toleranceMs = 0,
): RecordingSegment | null {
  const target = new Date(targetAt).getTime();
  return (
    segments.find(
      (segment) =>
        new Date(segment.startAt).getTime() - toleranceMs <= target &&
        new Date(segment.endAt).getTime() + toleranceMs >= target,
    ) ?? null
  );
}

export function mapPlaybackVideoTime(
  segment: RecordingSegment,
  videoTimeSeconds: number,
): string {
  const visibleSeconds = Math.max(0, videoTimeSeconds - (segment.contentOffsetSeconds ?? 0));
  return new Date(new Date(segment.startAt).getTime() + visibleSeconds * 1000).toISOString();
}

export function resolvePlaybackSource(
  segment: RecordingSegment,
  targetAt: string,
): ResolvedPlaybackSource {
  const segmentStart = new Date(segment.startAt).getTime();
  const segmentEnd = new Date(segment.endAt).getTime();
  const requested = Math.min(
    segmentEnd,
    Math.max(segmentStart, new Date(targetAt).getTime()),
  );
  const contentOffset = segment.contentOffsetSeconds ?? 0;

  try {
    const url = new URL(segment.playbackUrl);
    const isMediaMtxStream = url.pathname.endsWith("/get") && url.searchParams.has("path");
    if (
      isMediaMtxStream &&
      (requested - segmentStart > 250 || contentOffset > 0.25)
    ) {
      const timelineStartAt = new Date(requested).toISOString();
      url.searchParams.set("start", timelineStartAt);
      url.searchParams.set("duration", String(Math.max(0, (segmentEnd - requested) / 1000)));
      return {
        playbackUrl: url.toString(),
        timelineStartAt,
        videoOffsetSeconds: 0,
        targetVideoSeconds: 0,
      };
    }
  } catch {
    // Non-URL playback sources keep the normal media-element seek behavior.
  }

  return {
    playbackUrl: segment.playbackUrl,
    timelineStartAt: segment.startAt,
    videoOffsetSeconds: contentOffset,
    targetVideoSeconds: Math.max(0, contentOffset + (requested - segmentStart) / 1000),
  };
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
