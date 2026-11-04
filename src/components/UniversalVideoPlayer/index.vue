<template>
  <div class="universal-player" :data-state="state">
    <video
      ref="videoRef"
      class="universal-player__video"
      :class="{ 'is-visible': state === 'playing' }"
      autoplay
      controls
      muted
      playsinline
    />

    <div v-if="state !== 'playing'" class="universal-player__empty">
      <div class="universal-player__signal" :class="{ 'is-loading': state === 'loading' }" />
      <strong>{{ stateCopy.title }}</strong>
      <p>{{ stateCopy.detail }}</p>
      <button v-if="state === 'error'" type="button" @click="preparePlayback">重试视频线路</button>
    </div>

    <div class="universal-player__chrome">
      <span class="universal-player__live-dot" />
      <span>{{ cameraName }}</span>
      <small>{{ activeProtocolLabel }}</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { CameraPlayback, CameraStatus, PlaybackProtocol } from "@/features/monitoring/types";
import { getPlaybackCandidates } from "./usePlayback";

type PlayerState = "empty" | "loading" | "playing" | "error";

interface FlvPlayerLike {
  attachMediaElement(element: HTMLMediaElement): void;
  load(): void;
  play(): Promise<void> | void;
  pause(): void;
  unload(): void;
  detachMediaElement(): void;
  destroy(): void;
}

interface FlvModuleLike {
  isSupported(): boolean;
  createPlayer(source: Record<string, unknown>, options: Record<string, unknown>): FlvPlayerLike;
}

const props = defineProps<{
  cameraName: string;
  cameraStatus: CameraStatus;
  playback: CameraPlayback | null;
}>();

const videoRef = ref<HTMLVideoElement>();
const state = ref<PlayerState>("empty");
const activeProtocol = ref<PlaybackProtocol | null>(null);
let generation = 0;
let stopActiveMedia: (() => void) | null = null;

const activeProtocolLabel = computed(() => {
  if (state.value === "loading") return "正在连接";
  return {
    webrtc: "WebRTC 低延迟",
    hls: "HLS 稳定线路",
    flv: "HTTP-FLV",
  }[activeProtocol.value ?? "hls"];
});

const stateCopy = computed(() => {
  if (state.value === "loading") {
    return {
      title: "正在连接摄像头",
      detail: "系统会依次尝试 WebRTC、HLS 和 HTTP-FLV。",
    };
  }
  if (state.value === "error") {
    return {
      title: "视频线路暂时不可用",
      detail:
        props.cameraStatus === "OFFLINE"
          ? "摄像头当前离线，请检查供电和网络。"
          : "播放地址连接失败，请稍后重试或检查媒体服务。",
    };
  }
  return {
    title: "摄像头线路尚未接入",
    detail: "设备上线并配置 MediaMTX 播放地址后，此处自动显示实时画面。",
  };
});

function releaseMedia(): void {
  stopActiveMedia?.();
  stopActiveMedia = null;

  const video = videoRef.value;
  if (!video) return;
  video.pause();
  video.srcObject = null;
  video.removeAttribute("src");
  video.load();
}

async function playWebRtc(url: string, isCurrent: () => boolean): Promise<void> {
  const video = videoRef.value;
  if (!video) throw new Error("video element unavailable");

  const peer = new RTCPeerConnection();
  const controller = new AbortController();
  peer.addTransceiver("video", { direction: "recvonly" });
  peer.addTransceiver("audio", { direction: "recvonly" });
  peer.ontrack = (event) => {
    video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
  };

  stopActiveMedia = () => {
    controller.abort();
    peer.close();
  };

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
  if (!isCurrent()) return;
  await video.play();
}

async function playHls(url: string, isCurrent: () => boolean): Promise<void> {
  const video = videoRef.value;
  if (!video) throw new Error("video element unavailable");

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    await video.play();
    return;
  }

  const { default: Hls } = await import("hls.js");
  if (!Hls.isSupported()) throw new Error("HLS is not supported");

  const hls = new Hls({
    lowLatencyMode: true,
    backBufferLength: 30,
  });
  stopActiveMedia = () => hls.destroy();
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal && isCurrent()) scheduleNextCandidate();
  });
  hls.loadSource(url);
  hls.attachMedia(video);
  await video.play();
}

async function playFlv(url: string, isCurrent: () => boolean): Promise<void> {
  const video = videoRef.value;
  if (!video) throw new Error("video element unavailable");

  const { default: flvModule } = await import("flv.js");
  const flvjs = flvModule as unknown as FlvModuleLike;
  if (!flvjs.isSupported()) throw new Error("FLV is not supported");

  const player = flvjs.createPlayer(
    { type: "flv", url, isLive: true, hasAudio: true },
    { enableStashBuffer: false, stashInitialSize: 128 },
  );
  stopActiveMedia = () => {
    player.pause();
    player.unload();
    player.detachMediaElement();
    player.destroy();
  };
  player.attachMediaElement(video);
  player.load();
  await player.play();
  if (!isCurrent()) return;
}

let candidates: ReturnType<typeof getPlaybackCandidates> = [];
let candidateIndex = 0;
let candidateGeneration = 0;

function scheduleNextCandidate(): void {
  candidateIndex += 1;
  void tryCandidate(candidateGeneration);
}

async function tryCandidate(token: number): Promise<void> {
  if (token !== generation || !candidates[candidateIndex]) {
    if (token === generation) state.value = "error";
    return;
  }

  activeProtocol.value = candidates[candidateIndex].protocol;
  state.value = "loading";
  releaseMedia();
  const isCurrent = () => token === generation;
  candidateGeneration = token;

  try {
    const candidate = candidates[candidateIndex];
    if (candidate.protocol === "webrtc") await playWebRtc(candidate.url, isCurrent);
    if (candidate.protocol === "hls") await playHls(candidate.url, isCurrent);
    if (candidate.protocol === "flv") await playFlv(candidate.url, isCurrent);
    if (isCurrent()) state.value = "playing";
  } catch {
    if (isCurrent()) scheduleNextCandidate();
  }
}

async function preparePlayback(): Promise<void> {
  const token = ++generation;
  releaseMedia();
  activeProtocol.value = null;

  if (!props.playback) {
    state.value = "empty";
    return;
  }

  candidates = getPlaybackCandidates(props.playback);
  candidateIndex = 0;
  if (!candidates.length) {
    state.value = "empty";
    return;
  }

  await tryCandidate(token);
}

onMounted(() => {
  void preparePlayback();
});

watch(
  () => props.playback,
  () => {
    void preparePlayback();
  },
);

onBeforeUnmount(() => {
  generation += 1;
  releaseMedia();
});
</script>

<style scoped lang="scss">
.universal-player {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 240px;
  overflow: hidden;
  color: #eaf3f0;
  background:
    linear-gradient(rgb(6 32 31 / 96%), rgb(6 32 31 / 96%)),
    repeating-linear-gradient(0deg, transparent 0 39px, rgb(255 255 255 / 6%) 39px 40px);
}

.universal-player__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;

  &.is-visible {
    opacity: 1;
  }
}

.universal-player__empty {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 8px;
  justify-items: center;
  width: min(420px, 80%);
  text-align: center;

  strong {
    font-size: 15px;
    font-weight: 600;
  }

  p {
    margin: 0;
    font-size: 11px;
    line-height: 1.7;
    color: #9db3ac;
  }

  button {
    padding: 7px 12px;
    margin-top: 6px;
    font-size: 11px;
    color: #dcebe6;
    cursor: pointer;
    background: transparent;
    border: 1px solid #789e92;

    &:focus-visible {
      outline: 2px solid #b7ddd1;
      outline-offset: 2px;
    }
  }
}

.universal-player__signal {
  width: 44px;
  height: 44px;
  margin-bottom: 7px;
  border: 1px solid rgb(157 205 190 / 35%);
  border-radius: 50%;
  box-shadow:
    0 0 0 14px rgb(157 205 190 / 5%),
    0 0 0 28px rgb(157 205 190 / 3%);

  &.is-loading {
    animation: signal-pulse 1.5s ease-in-out infinite;
  }
}

.universal-player__chrome {
  position: absolute;
  right: 12px;
  bottom: 10px;
  left: 12px;
  z-index: 2;
  display: flex;
  gap: 7px;
  align-items: center;
  font-size: 10px;
  color: #c8d9d4;

  small {
    margin-left: auto;
    color: #8faca3;
  }
}

.universal-player__live-dot {
  width: 6px;
  height: 6px;
  background: #718781;
  border-radius: 50%;
}

.universal-player[data-state="playing"] .universal-player__live-dot {
  background: #5ed09e;
  box-shadow: 0 0 0 4px rgb(94 208 158 / 12%);
}

@keyframes signal-pulse {
  50% {
    box-shadow:
      0 0 0 20px rgb(157 205 190 / 8%),
      0 0 0 36px rgb(157 205 190 / 2%);
    transform: scale(0.92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .universal-player__signal {
    animation: none !important;
  }
}
</style>
