import { describe, expect, it } from "vitest";
import { getPlaybackCandidates, withHlsCookieCheck } from "./usePlayback";

const basePlayback = {
  cameraId: "camera-a",
  preferredProtocol: "hls" as const,
  webrtcUrl: "https://media.example/camera-a/whep",
  hlsUrl: "https://media.example/camera-a/index.m3u8",
  flvUrl: "https://media.example/camera-a.flv",
  expiresAt: "2026-11-04T17:00:00+08:00",
};

describe("getPlaybackCandidates", () => {
  it("returns HLS, WebRTC and FLV in reliability order", () => {
    expect(getPlaybackCandidates(basePlayback).map((item) => item.protocol)).toEqual([
      "hls",
      "webrtc",
      "flv",
    ]);
  });

  it("omits protocols without a playback URL", () => {
    expect(
      getPlaybackCandidates({
        ...basePlayback,
        webrtcUrl: null,
        flvUrl: null,
      }).map((item) => item.protocol),
    ).toEqual(["hls"]);
  });

  it("adds the MediaMTX cookie check without duplicating it", () => {
    expect(
      withHlsCookieCheck("https://media.example/camera-a/index.m3u8"),
    ).toBe("https://media.example/camera-a/index.m3u8?cookieCheck=1");
    expect(
      withHlsCookieCheck("https://media.example/camera-a/index.m3u8?cookieCheck=1"),
    ).toBe("https://media.example/camera-a/index.m3u8?cookieCheck=1");
  });
});
