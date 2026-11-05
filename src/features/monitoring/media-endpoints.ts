import type { Camera } from "./types";

const DEFAULT_WEBRTC_BASE =
  import.meta.env.VITE_MEDIA_WEBRTC_BASE_URL ?? "http://10.208.236.131:8889";
const DEFAULT_HLS_BASE =
  import.meta.env.VITE_MEDIA_HLS_BASE_URL ?? "http://10.208.236.131:8888";
const DEFAULT_RTSP_BASE =
  import.meta.env.VITE_MEDIA_RTSP_BASE_URL ?? "rtsp://10.208.236.131:8554";
const DEFAULT_PLAYBACK_API_BASE =
  import.meta.env.VITE_MEDIA_PLAYBACK_API_BASE_URL ?? "http://10.208.236.131:9996";

export interface CameraMediaEndpoints {
  mediaPath: string;
  webRtcViewUrl: string;
  webRtcUrl: string;
  hlsUrl: string;
  rtspUrl: string;
  playbackApiBaseUrl: string;
}

/**
 * Resolve playback endpoints from the camera record first, so cameras on
 * different MediaMTX shards can coexist without a global hard-coded host.
 */
export function getCameraMediaEndpoints(camera: Camera): CameraMediaEndpoints {
  const mediaPath = camera.mediaPath ?? camera.cameraKey;
  const webRtcUrl = camera.playback?.webrtcUrl ?? `${trimSlash(DEFAULT_WEBRTC_BASE)}/${mediaPath}/whep`;
  const hlsUrl =
    camera.playback?.hlsUrl ?? `${trimSlash(DEFAULT_HLS_BASE)}/${mediaPath}/index.m3u8`;
  const webRtcViewUrl = webRtcUrl.replace(/\/whep\/?$/i, "");
  const rtspUrl =
    camera.playback?.hlsUrl || camera.playback?.webrtcUrl
      ? `${deriveRtspBase(webRtcUrl)}/${mediaPath}`
      : `${trimSlash(DEFAULT_RTSP_BASE)}/${mediaPath}`;

  return {
    mediaPath,
    webRtcViewUrl,
    webRtcUrl,
    hlsUrl,
    rtspUrl,
    playbackApiBaseUrl: derivePlaybackApiBase(camera.playback?.webrtcUrl),
  };
}

function deriveRtspBase(webRtcUrl: string): string {
  try {
    const url = new URL(webRtcUrl);
    return `rtsp://${url.hostname}:8554`;
  } catch {
    return trimSlash(DEFAULT_RTSP_BASE);
  }
}

function derivePlaybackApiBase(webRtcUrl: string | null | undefined): string {
  const configured = import.meta.env.VITE_MEDIA_PLAYBACK_API_BASE_URL;
  if (configured) return trimSlash(configured);
  if (!webRtcUrl) return trimSlash(DEFAULT_PLAYBACK_API_BASE);
  try {
    const url = new URL(webRtcUrl);
    const protocol = url.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${url.hostname}:9996`;
  } catch {
    return trimSlash(DEFAULT_PLAYBACK_API_BASE);
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
