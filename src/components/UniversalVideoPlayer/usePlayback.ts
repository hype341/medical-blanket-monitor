import type { CameraPlayback, PlaybackProtocol } from "@/features/monitoring/types";

export interface PlaybackCandidate {
  protocol: PlaybackProtocol;
  url: string;
}

export function getPlaybackCandidates(playback: CameraPlayback): PlaybackCandidate[] {
  return [
    { protocol: "webrtc", url: playback.webrtcUrl },
    { protocol: "hls", url: playback.hlsUrl },
    { protocol: "flv", url: playback.flvUrl },
  ].filter((candidate): candidate is PlaybackCandidate => Boolean(candidate.url));
}
