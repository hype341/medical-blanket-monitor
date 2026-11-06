import { describe, expect, it } from "vitest";
import {
  buildClipWindow,
  findPlaybackSegment,
  mapMediaMtxPlaybackItems,
  normalizePlaybackSegments,
  parseAlarmMessage,
  pruneExpiredSegments,
} from "./recording";

const segments = [
  {
    id: "segment-01",
    cameraKey: "camera-01",
    startAt: "2026-11-04T17:00:00+08:00",
    endAt: "2026-11-04T17:05:00+08:00",
    playbackUrl: "/live/recordings/camera-01/segment-01/index.m3u8",
  },
  {
    id: "segment-02",
    cameraKey: "camera-01",
    startAt: "2026-11-04T17:05:00+08:00",
    endAt: "2026-11-04T17:10:00+08:00",
    playbackUrl: "/live/recordings/camera-01/segment-02/index.m3u8",
  },
];

describe("alarm MQTT contract", () => {
  it("parses an alarm with its camera, bed and occurrence time", () => {
    const alarm = parseAlarmMessage(
      JSON.stringify({
        alarmId: "alarm-01",
        code: "TEMPERATURE_HIGH",
        level: "WARNING",
        title: "传感器状态异常",
        detail: "设备上报状态变化",
        sensorKey: "blanket-001",
        cameraKey: "camera-01",
        wardId: "ward-a",
        roomId: "room-a-301",
        bedId: "bed-a-01",
        occurredAt: "2026-11-04T17:04:20+08:00",
      }),
    );

    expect(alarm?.cameraKey).toBe("camera-01");
    expect(alarm?.occurredAt).toBe("2026-11-04T17:04:20+08:00");
    expect(alarm?.status).toBe("OPEN");
  });

  it("accepts a simplified room alarm payload", () => {
    const alarm = parseAlarmMessage(
      JSON.stringify({
        alarmId: "alarm-simple",
        level: "WARNING",
        title: "床位状态异常",
        bedId: "bed-a-01",
        occurredAt: "2026-11-04T17:04:20+08:00",
      }),
    );

    expect(alarm?.code).toBe("BED_ALARM");
    expect(alarm?.bedId).toBe("bed-a-01");
    expect(alarm?.detail).toBe("床位状态异常");
  });
});

describe("recording clip window", () => {
  it("keeps the configured time before and after an alarm", () => {
    expect(
      buildClipWindow("2026-11-04T17:04:20+08:00", {
        beforeSeconds: 30,
        afterSeconds: 60,
      }),
    ).toEqual({
      startAt: "2026-11-04T17:03:50+08:00",
      endAt: "2026-11-04T17:05:20+08:00",
    });
  });
});

describe("rolling recording timeline", () => {
  it("finds the segment containing a requested timestamp", () => {
    expect(findPlaybackSegment(segments, "2026-11-04T17:07:00+08:00")?.id).toBe("segment-02");
  });

  it("allows second-level input near a millisecond segment boundary", () => {
    const preciseSegments = [
      {
        ...segments[0],
        startAt: "2026-11-04T17:00:00.700+08:00",
      },
    ];
    expect(findPlaybackSegment(preciseSegments, "2026-11-04T17:00:00+08:00", 2_000)?.id).toBe(
      "segment-01",
    );
  });

  it("maps MediaMTX playback files to browser URLs", () => {
    expect(
      mapMediaMtxPlaybackItems(
        [
          {
            start: "2026-11-04T10:24:19.000Z",
            duration: 60,
            url: "http://127.0.0.1:9996/get?path=camera-01&start=10%3A24%3A19Z",
          },
        ],
        "camera-01",
        "http://10.208.236.131:9996",
      )[0],
    ).toMatchObject({
      startAt: "2026-11-04T10:24:19.000Z",
      endAt: "2026-11-04T10:25:19.000Z",
      playbackUrl: "http://10.208.236.131:9996/get?path=camera-01&start=10%3A24%3A19Z",
    });
  });

  it("removes contained overlaps and offsets partially overlapping recordings", () => {
    const normalized = normalizePlaybackSegments([
      {
        ...segments[0],
        startAt: "2026-11-04T17:00:00.000Z",
        endAt: "2026-11-04T17:05:00.000Z",
      },
      {
        ...segments[1],
        id: "contained",
        startAt: "2026-11-04T17:04:00.000Z",
        endAt: "2026-11-04T17:04:30.000Z",
      },
      {
        ...segments[1],
        id: "extended",
        startAt: "2026-11-04T17:04:30.000Z",
        endAt: "2026-11-04T17:10:00.000Z",
      },
    ]);

    expect(normalized.map((segment) => segment.id)).toEqual(["segment-01", "extended"]);
    expect(normalized[1].startAt).toBe("2026-11-04T17:05:00.000Z");
    expect(normalized[1].contentOffsetSeconds).toBe(30);
  });

  it("removes segments outside the server retention window", () => {
    expect(pruneExpiredSegments(segments, "2026-11-04T17:10:00+08:00", 6)).toEqual([segments[1]]);
  });
});
