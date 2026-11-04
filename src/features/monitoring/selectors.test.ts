import { describe, expect, it } from "vitest";
import { filterBedSummaries, getBedMonitorSummary, selectPlaybackProtocol } from "./selectors";
import router from "@/router";

const data = {
  beds: [
    {
      id: "bed-a",
      wardId: "ward-a",
      roomId: "room-a",
      bedNo: "01",
      patientName: "张阿姨",
      status: "OCCUPIED" as const,
      updatedAt: "2026-11-04T16:30:00+08:00",
    },
  ],
  sensors: [
    {
      id: "sensor-a",
      deviceKey: "sensor-a",
      name: "A-01 毯子传感器",
      status: "ONLINE" as const,
      lastSeenAt: "2026-11-04T16:30:00+08:00",
      latestMetrics: {
        surfaceTemperature: 33.4,
        bodyTemperature: 36.7,
        pressure: 4.82,
      },
    },
  ],
  cameras: [
    {
      id: "camera-main",
      cameraKey: "camera-main",
      name: "床旁摄像头",
      status: "ONLINE" as const,
      playback: {
        cameraId: "camera-main",
        preferredProtocol: "webrtc" as const,
        webrtcUrl: "https://media.example/camera-main/whep",
        hlsUrl: "https://media.example/camera-main/index.m3u8",
        flvUrl: null,
        expiresAt: "2026-11-04T17:00:00+08:00",
      },
    },
  ],
  bindings: [
    {
      id: "binding-sensor",
      bedId: "bed-a",
      sensorDeviceId: "sensor-a",
      cameraId: null,
      role: "PRIMARY_SENSOR" as const,
      status: "ACTIVE" as const,
    },
    {
      id: "binding-camera-main",
      bedId: "bed-a",
      sensorDeviceId: null,
      cameraId: "camera-main",
      role: "PRIMARY_CAMERA" as const,
      status: "ACTIVE" as const,
    },
  ],
};

describe("getBedMonitorSummary", () => {
  it("returns the active sensor and all active cameras for a bed", () => {
    const summary = getBedMonitorSummary("bed-a", data);

    expect(summary?.sensor?.deviceKey).toBe("sensor-a");
    expect(summary?.cameras.map((camera) => camera.cameraKey)).toEqual(["camera-main"]);
  });
});

describe("selectPlaybackProtocol", () => {
  it("prefers WebRTC over HLS and FLV", () => {
    expect(
      selectPlaybackProtocol({
        cameraId: "camera-a",
        preferredProtocol: "hls",
        webrtcUrl: "https://media.example/camera-a/whep",
        hlsUrl: "https://media.example/camera-a/index.m3u8",
        flvUrl: "https://media.example/camera-a.flv",
        expiresAt: "2026-11-04T17:00:00+08:00",
      }),
    ).toBe("webrtc");
  });

  it("falls back to HLS when WebRTC is unavailable", () => {
    expect(
      selectPlaybackProtocol({
        cameraId: "camera-a",
        preferredProtocol: "flv",
        webrtcUrl: null,
        hlsUrl: "https://media.example/camera-a/index.m3u8",
        flvUrl: "https://media.example/camera-a.flv",
        expiresAt: "2026-11-04T17:00:00+08:00",
      }),
    ).toBe("hls");
  });
});

describe("filterBedSummaries", () => {
  it("filters by ward and supports room or patient search", () => {
    const summary = getBedMonitorSummary("bed-a", data);
    expect(summary).not.toBeNull();

    expect(
      filterBedSummaries([summary!], {
        wardId: "ward-a",
        query: "张阿姨",
      }),
    ).toHaveLength(1);

    expect(
      filterBedSummaries([summary!], {
        wardId: "ward-b",
        query: "",
      }),
    ).toHaveLength(0);
  });
});

describe("hospital product routes", () => {
  it("registers the nurse monitoring routes", () => {
    expect(router.getRoutes().map((route) => route.path)).toEqual(
      expect.arrayContaining([
        "/overview",
        "/beds",
        "/beds/:bedId",
        "/bindings",
        "/devices/cameras",
        "/admin/wards",
        "/admin/staff",
        "/admin/policy",
      ]),
    );
  });
});
