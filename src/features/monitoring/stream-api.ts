import mqtt, { type MqttClient } from "mqtt";
import type { CameraPlayback, MqttSettings } from "./types";
import { parseSensorPayload, type SensorTelemetryEnvelope } from "./processing";
import { parseAlarmMessage, type AlarmEnvelope } from "./recording";
import { LEGACY_SENSOR_EVENT_TOPIC, SENSOR_DATA_TOPIC } from "./messaging";
import { getPlaybackCandidates } from "@/components/UniversalVideoPlayer/usePlayback";

export interface SensorStreamHandlers {
  onTelemetry?: (reading: SensorTelemetryEnvelope) => void;
  onAlarm?: (alarm: AlarmEnvelope) => void;
  onStatus?: (status: "connecting" | "connected" | "reconnecting" | "closed") => void;
  onError?: (error: Error) => void;
}

export interface SensorStreamController {
  close: () => void;
}

export interface SensorDataStreamHandlers {
  onData?: (reading: SensorTelemetryEnvelope) => void;
  onStatus?: SensorStreamHandlers["onStatus"];
  onError?: (error: Error) => void;
}

export interface CameraStreamHandlers {
  onReady?: (stream: MediaStream | null, protocol: "webrtc" | "hls" | "flv") => void;
  onError?: (error: Error) => void;
}

export interface CameraStreamController {
  mediaStream: MediaStream | null;
  protocol: "webrtc" | "hls" | "flv";
  close: () => void;
}

export function openMqttSensorStream(
  settings: MqttSettings,
  handlers: SensorStreamHandlers = {},
): SensorStreamController {
  let client: MqttClient | null = null;
  let closed = false;

  try {
    handlers.onStatus?.("connecting");
    client = mqtt.connect(settings.websocketUrl, {
      clientId: `${settings.clientId}-${randomClientSuffix()}`,
      username: settings.username,
      password: settings.password,
      reconnectPeriod: 3_000,
      connectTimeout: 10_000,
      clean: true,
    });

    client.on("connect", () => {
      if (!client || closed) return;
      handlers.onStatus?.("connected");
      client.subscribe(
        [SENSOR_DATA_TOPIC, LEGACY_SENSOR_EVENT_TOPIC, settings.alarmTopic],
        { qos: settings.qos },
        (error) => {
          if (error) handlers.onError?.(error);
        },
      );
    });
    client.on("reconnect", () => handlers.onStatus?.("reconnecting"));
    client.on("error", (error) => handlers.onError?.(error));
    client.on("message", (topic, payload) => {
      const text = payload.toString("utf8");
      if (topic.endsWith("/alarm")) {
        const alarm = parseAlarmMessage(text);
        if (alarm) handlers.onAlarm?.(alarm);
        return;
      }
      const reading = parseSensorPayload(text);
      if (reading) {
        handlers.onTelemetry?.(reading);
      } else {
        handlers.onError?.(new Error(`Invalid sensor payload on ${topic}`));
      }
    });
  } catch (error) {
    handlers.onError?.(error instanceof Error ? error : new Error("MQTT connection failed"));
  }

  return {
    close() {
      closed = true;
      client?.end(true);
      handlers.onStatus?.("closed");
    },
  };
}

/**
 * Subscribe to one bed's sensor data topic only.
 */
export function openSensorDataStream(
  settings: MqttSettings,
  dataTopic: string,
  handlers: SensorDataStreamHandlers = {},
): SensorStreamController {
  let client: MqttClient | null = null;
  let closed = false;

  try {
    handlers.onStatus?.("connecting");
    client = mqtt.connect(settings.websocketUrl, {
      clientId: `${settings.clientId}-${dataTopic.split("/").at(-2) ?? "sensor"}-${randomClientSuffix()}`,
      username: settings.username,
      password: settings.password,
      reconnectPeriod: 3_000,
      connectTimeout: 10_000,
      clean: true,
    });
    client.on("connect", () => {
      if (!client || closed) return;
      handlers.onStatus?.("connected");
      client.subscribe([dataTopic], { qos: settings.qos }, (error) => {
        if (error) handlers.onError?.(error);
      });
    });
    client.on("reconnect", () => handlers.onStatus?.("reconnecting"));
    client.on("error", (error) => handlers.onError?.(error));
    client.on("message", (_topic, payload) => {
      const reading = parseSensorPayload(payload.toString("utf8"));
      if (reading) {
        handlers.onData?.(reading);
      } else {
        handlers.onError?.(new Error(`Invalid sensor payload on ${dataTopic}`));
      }
    });
  } catch (error) {
    handlers.onError?.(
      error instanceof Error ? error : new Error("Sensor stream connection failed"),
    );
  }

  return {
    close() {
      closed = true;
      client?.end(true);
      handlers.onStatus?.("closed");
    },
  };
}

export interface PlatformAlarmStreamHandlers {
  onAlarm?: (alarm: AlarmEnvelope) => void;
  onDeleted?: (alarmId: string) => void;
  onStatus?: SensorStreamHandlers["onStatus"];
  onError?: (error: Error) => void;
}

export function openPlatformAlarmStream(
  handlers: PlatformAlarmStreamHandlers = {},
): SensorStreamController {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    handlers.onStatus?.("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${window.location.host}/ws/alarms`);
    socket.onopen = () => handlers.onStatus?.("connected");
    socket.onmessage = (event) => {
      const raw = String(event.data);
      let message: { event?: string; alarm?: unknown; alarmId?: string };
      try {
        message = JSON.parse(raw) as typeof message;
      } catch {
        return;
      }
      if (message.event === "alarm.deleted" && message.alarmId) {
        handlers.onDeleted?.(message.alarmId);
        return;
      }
      const alarm = parseAlarmMessage(
        message.event && message.alarm ? JSON.stringify(message.alarm) : raw,
      );
      if (alarm) handlers.onAlarm?.(alarm);
    };
    socket.onerror = () => handlers.onError?.(new Error("Alarm WebSocket connection failed"));
    socket.onclose = () => {
      if (closed) return;
      handlers.onStatus?.("reconnecting");
      reconnectTimer = setTimeout(connect, 3_000);
    };
  };

  connect();
  return {
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
      handlers.onStatus?.("closed");
    },
  };
}

export async function openCameraPlaybackStream(
  playback: CameraPlayback,
  video: HTMLVideoElement,
  handlers: CameraStreamHandlers = {},
): Promise<CameraStreamController> {
  const candidates = getPlaybackCandidates(playback);
  let cleanup: (() => void) | null = null;
  let mediaStream: MediaStream | null = null;
  let closed = false;

  for (const candidate of candidates) {
    try {
      if (candidate.protocol === "webrtc") {
        const result = await connectWebRtc(candidate.url, video);
        cleanup = result.cleanup;
        mediaStream = result.stream;
      } else if (candidate.protocol === "hls") {
        cleanup = await connectHls(candidate.url, video);
      } else {
        cleanup = await connectFlv(candidate.url, video);
      }
      if (closed) cleanup?.();
      handlers.onReady?.(mediaStream, candidate.protocol);
      return {
        mediaStream,
        protocol: candidate.protocol,
        close() {
          closed = true;
          cleanup?.();
          video.pause();
          video.srcObject = null;
          video.removeAttribute("src");
          video.load();
        },
      };
    } catch {
      cleanup?.();
      cleanup = null;
      mediaStream = null;
    }
  }

  const error = new Error("No camera playback protocol is available");
  handlers.onError?.(error);
  throw error;
}

async function connectWebRtc(
  url: string,
  video: HTMLVideoElement,
): Promise<{ stream: MediaStream; cleanup: () => void }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6_000);
  const peer = new RTCPeerConnection();
  peer.addTransceiver("video", { direction: "recvonly" });
  peer.addTransceiver("audio", { direction: "recvonly" });
  peer.ontrack = (event) => {
    video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
  };
  try {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`WHEP failed: ${response.status}`);
    await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
    await video.play();
  } catch (error) {
    controller.abort();
    peer.close();
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  return {
    stream: video.srcObject as MediaStream,
    cleanup() {
      window.clearTimeout(timeout);
      controller.abort();
      peer.close();
    },
  };
}

function randomClientSuffix(): string {
  return globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
}

async function connectHls(url: string, video: HTMLVideoElement): Promise<() => void> {
  const { default: Hls } = await import("hls.js");
  if (!Hls.isSupported()) throw new Error("HLS is not supported");
  const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
  hls.loadSource(url);
  hls.attachMedia(video);
  await video.play();
  return () => hls.destroy();
}

async function connectFlv(url: string, video: HTMLVideoElement): Promise<() => void> {
  const { default: flvModule } = await import("flv.js");
  const flvjs = flvModule as unknown as {
    isSupported: () => boolean;
    createPlayer: (
      source: Record<string, unknown>,
      options: Record<string, unknown>,
    ) => {
      attachMediaElement: (element: HTMLMediaElement) => void;
      load: () => void;
      play: () => Promise<void> | void;
      pause: () => void;
      unload: () => void;
      detachMediaElement: () => void;
      destroy: () => void;
    };
  };
  if (!flvjs.isSupported()) throw new Error("FLV is not supported");
  const player = flvjs.createPlayer(
    { type: "flv", url, isLive: true, hasAudio: true },
    { enableStashBuffer: false, stashInitialSize: 128 },
  );
  player.attachMediaElement(video);
  player.load();
  await player.play();
  return () => {
    player.pause();
    player.unload();
    player.detachMediaElement();
    player.destroy();
  };
}
