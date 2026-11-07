import type { CameraPlayback, PlaybackProtocol } from "@/features/monitoring/types";

export interface PlaybackCandidate {
  protocol: PlaybackProtocol;
  url: string;
}

export function getPlaybackCandidates(playback: CameraPlayback): PlaybackCandidate[] {
  return [
    { protocol: "hls", url: playback.hlsUrl },
    { protocol: "webrtc", url: playback.webrtcUrl },
    { protocol: "flv", url: playback.flvUrl },
  ].filter((candidate): candidate is PlaybackCandidate => Boolean(candidate.url));
}

export function withHlsCookieCheck(url: string): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("cookieCheck")) {
    parsed.searchParams.set("cookieCheck", "1");
  }
  return parsed.toString();
}
