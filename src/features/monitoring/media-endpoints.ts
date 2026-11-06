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
  rtmpUrl: string;
  playbackApiBaseUrl: string;
}

/**
 * Resolve playback endpoints from the camera record first, so cameras on
 * different MediaMTX shards can coexist without a global hard-coded host.
 */
export function getCameraMediaEndpoints(camera: Camera): CameraMediaEndpoints {
  const mediaPath = camera.mediaPath ?? camera.cameraKey;
  const node = getMediaNodeBases(camera.mediaServerUrl);
  const webRtcUrl = camera.playback?.webrtcUrl ?? `${node.webRtcBase}/${mediaPath}/whep`;
  const hlsUrl =
    camera.playback?.hlsUrl ?? `${node.hlsBase}/${mediaPath}/index.m3u8`;
  const webRtcViewUrl = webRtcUrl.replace(/\/whep\/?$/i, "");
  const rtspUrl =
    camera.playback?.hlsUrl || camera.playback?.webrtcUrl
      ? `${deriveRtspBase(webRtcUrl)}/${mediaPath}`
      : `${node.rtspBase}/${mediaPath}`;

  return {
    mediaPath,
    webRtcViewUrl,
    webRtcUrl,
    hlsUrl,
    rtspUrl,
    rtmpUrl: `${node.rtmpBase}/${mediaPath}`,
    playbackApiBaseUrl: derivePlaybackApiBase(camera.playback?.webrtcUrl, node.playbackBase),
  };
}

export function getCameraPublishUrl(camera: Camera): string {
  return getCameraMediaEndpoints(camera).rtspUrl;
}

function deriveRtspBase(webRtcUrl: string): string {
  try {
    const url = new URL(webRtcUrl);
    return `rtsp://${url.hostname}:8554`;
  } catch {
    return trimSlash(DEFAULT_RTSP_BASE);
  }
}

function derivePlaybackApiBase(
  webRtcUrl: string | null | undefined,
  nodePlaybackBase: string,
): string {
  const configured = import.meta.env.VITE_MEDIA_PLAYBACK_API_BASE_URL;
  if (configured) return trimSlash(configured);
  if (!webRtcUrl) return nodePlaybackBase;
  try {
    const url = new URL(webRtcUrl);
    const protocol = url.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${url.hostname}:9996`;
  } catch {
    return trimSlash(DEFAULT_PLAYBACK_API_BASE);
  }
}

function getMediaNodeBases(mediaServerUrl: string | undefined) {
  if (!mediaServerUrl?.trim()) {
    return {
      webRtcBase: trimSlash(DEFAULT_WEBRTC_BASE),
      hlsBase: trimSlash(DEFAULT_HLS_BASE),
      rtspBase: trimSlash(DEFAULT_RTSP_BASE),
      rtmpBase: `rtmp://${new URL(DEFAULT_RTSP_BASE).hostname}:1935`,
      playbackBase: trimSlash(DEFAULT_PLAYBACK_API_BASE),
    };
  }
  try {
    const url = new URL(mediaServerUrl);
    const host = url.hostname;
    const httpProtocol = url.protocol === "https:" ? "https:" : "http:";
    return {
      webRtcBase: `${httpProtocol}//${host}:8889`,
      hlsBase: `${httpProtocol}//${host}:8888`,
      rtspBase: `rtsp://${host}:8554`,
      rtmpBase: `rtmp://${host}:1935`,
      playbackBase: `${httpProtocol}//${host}:9996`,
    };
  } catch {
    return {
      webRtcBase: trimSlash(DEFAULT_WEBRTC_BASE),
      hlsBase: trimSlash(DEFAULT_HLS_BASE),
      rtspBase: trimSlash(DEFAULT_RTSP_BASE),
      playbackBase: trimSlash(DEFAULT_PLAYBACK_API_BASE),
    };
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
