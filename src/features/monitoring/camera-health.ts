import type { Camera, CameraStatus } from "./types";
import { getCameraMediaEndpoints } from "./media-endpoints";

export interface CameraHealthResult {
  cameraId: string;
  status: CameraStatus;
  latencyMs: number;
  detail: string;
  checkedAt: string;
}

export async function probeCameraHealth(
  cameras: Camera[],
  signal?: AbortSignal,
  options: { browserFallback?: boolean } = {},
): Promise<CameraHealthResult[]> {
  const unique = Array.from(new Map(cameras.map((camera) => [camera.id, camera])).values()).slice(
    0,
    100,
  );
  if (!unique.length) return [];

  const requests = unique.map((camera) => {
    const endpoints = getCameraMediaEndpoints(camera);
    let baseUrl = camera.playback?.hlsUrl?.split("/").slice(0, 3).join("/");
    if (!baseUrl) {
      try {
        baseUrl = new URL(endpoints.hlsUrl).origin;
      } catch {
        baseUrl = "";
      }
    }
    return {
      cameraId: camera.id,
      baseUrl,
      path: endpoints.mediaPath,
    };
  });

  const response = await fetch("/api/public/camera-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requests),
    signal,
  });
  if (!response.ok) throw new Error(`摄像头状态接口返回 HTTP ${response.status}`);
  const results = (await response.json()) as CameraHealthResult[];
  const validResults = Array.isArray(results)
    ? results.filter(
        (result) =>
          result &&
          typeof result.cameraId === "string" &&
          ["ONLINE", "OFFLINE", "STALE"].includes(result.status),
      )
    : [];
  if (options.browserFallback === false) return validResults;

  return Promise.all(
    validResults.map(async (result) => {
      if (result.status === "ONLINE") return result;
      const camera = unique.find((item) => item.id === result.cameraId);
      if (!camera) return result;
      const online = await probeBrowserMedia(camera, signal);
      return online
        ? {
            ...result,
            status: "ONLINE" as const,
            detail: "浏览器已连通媒体节点",
          }
        : result;
    }),
  );
}

async function probeBrowserMedia(camera: Camera, signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), 3_000);
  try {
    const endpoints = getCameraMediaEndpoints(camera);
    await fetch(`${endpoints.hlsUrl}?cookieCheck=1`, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
