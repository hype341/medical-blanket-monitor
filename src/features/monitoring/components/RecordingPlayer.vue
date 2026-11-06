<template>
  <div class="recording-player" :data-state="mediaState">
    <video
      ref="videoARef"
      class="recording-player__video"
      :class="{ 'is-active': activeSlot === 'a' }"
      :controls="activeSlot === 'a'"
      playsinline
      muted
      preload="auto"
      @timeupdate="handleTimeUpdate('a')"
      @play="handlePlay('a')"
      @pause="handlePause('a')"
      @waiting="handleWaiting('a')"
      @playing="handlePlaying('a')"
      @ended="handleEnded('a')"
      @error="handleError('a')"
    />
    <video
      ref="videoBRef"
      class="recording-player__video"
      :class="{ 'is-active': activeSlot === 'b' }"
      :controls="activeSlot === 'b'"
      playsinline
      muted
      preload="auto"
      @timeupdate="handleTimeUpdate('b')"
      @play="handlePlay('b')"
      @pause="handlePause('b')"
      @waiting="handleWaiting('b')"
      @playing="handlePlaying('b')"
      @ended="handleEnded('b')"
      @error="handleError('b')"
    />

    <div v-if="mediaState === 'empty' || mediaState === 'error'" class="recording-player__empty">
      <span class="recording-player__empty-signal" aria-hidden="true" />
      <strong>{{ errorMessage || "没有可播放的录像片段" }}</strong>
      <p>录像索引每 5 秒刷新，正在录制的片段最多约 15 秒后进入连续回放。</p>
    </div>

    <div class="recording-player__chrome">
      <span class="recording-player__mode">连续回放</span>
      <strong>{{ currentTimeLabel }}</strong>
      <small>{{ statusLabel }}</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import {
  mapPlaybackVideoTime,
  resolvePlaybackSource,
  type RecordingSegment,
} from "../recording";

type Slot = "a" | "b";
type MediaState = "empty" | "loading" | "buffering" | "playing" | "paused" | "ended" | "error";

const props = withDefaults(
  defineProps<{
    segments?: RecordingSegment[];
    targetAt?: string;
  }>(),
  {
    segments: () => [],
    targetAt: "",
  },
);

const emit = defineEmits<{
  "time-update": [currentAt: string];
  "state-change": [state: MediaState];
}>();

const videoARef = ref<HTMLVideoElement>();
const videoBRef = ref<HTMLVideoElement>();
const activeSlot = ref<Slot>("a");
const activeSegmentId = ref("");
const currentAbsoluteMs = ref(0);
const mediaState = ref<MediaState>("empty");
const errorMessage = ref("");
let loadGeneration = 0;
let switching = false;
let preloadingSegmentId = "";

const sortedSegments = computed(() =>
  [...props.segments].sort(
    (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  ),
);

const currentTimeLabel = computed(() => {
  if (!currentAbsoluteMs.value) return "--:--:--";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(currentAbsoluteMs.value));
});

const statusLabel = computed(() => {
  return {
    empty: "等待录像",
    loading: "准备片段",
    buffering: "正在缓冲",
    playing: "平滑播放",
    paused: "已暂停",
    ended: "本段结束",
    error: "回放不可用",
  }[mediaState.value];
});

function getVideo(slot: Slot): HTMLVideoElement | null {
  return slot === "a" ? (videoARef.value ?? null) : (videoBRef.value ?? null);
}

function getOtherSlot(slot: Slot): Slot {
  return slot === "a" ? "b" : "a";
}

function updateMediaState(state: MediaState): void {
  mediaState.value = state;
  emit("state-change", state);
}

function findSegmentAt(targetAt: string): RecordingSegment | null {
  const target = new Date(targetAt).getTime();
  return (
    sortedSegments.value.find(
      (segment) =>
        new Date(segment.startAt).getTime() - 2_000 <= target &&
        new Date(segment.endAt).getTime() + 2_000 >= target,
    ) ?? null
  );
}

function findNextSegment(segment: RecordingSegment): RecordingSegment | null {
  const index = sortedSegments.value.findIndex((item) => item.id === segment.id);
  return index >= 0 ? (sortedSegments.value[index + 1] ?? null) : null;
}

async function waitForMetadata(video: HTMLVideoElement, generation: number): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("录像片段加载超时"));
    }, 12_000);
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("录像片段加载失败"));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("error", onError);
    };

    video.addEventListener("loadedmetadata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
    if (generation !== loadGeneration) {
      cleanup();
      reject(new Error("已切换回放位置"));
    }
  });
}

async function seekVideo(
  video: HTMLVideoElement,
  targetSeconds: number,
  generation: number,
): Promise<void> {
  const target = Math.max(
    0,
    Math.min(
      Number.isFinite(video.duration) ? video.duration : Number.MAX_SAFE_INTEGER,
      targetSeconds,
    ),
  );
  if (!video.seeking && Math.abs(video.currentTime - target) < 0.05) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("录像定位超时"));
    }, 8_000);
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("录像定位失败"));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = target;
    if (generation !== loadGeneration) {
      cleanup();
      reject(new Error("已切换回放位置"));
    }
  });
}

async function loadSegment(
  slot: Slot,
  segment: RecordingSegment,
  targetAt: string,
  autoplay: boolean,
): Promise<void> {
  const video = getVideo(slot);
  if (!video) throw new Error("视频播放器尚未就绪");

  const generation = loadGeneration;
  const source = resolvePlaybackSource(segment, targetAt);
  video.pause();
  video.src = source.playbackUrl;
  video.load();
  await waitForMetadata(video, generation);
  if (generation !== loadGeneration) throw new Error("已切换回放位置");

  await seekVideo(video, source.targetVideoSeconds, generation);
  if (generation !== loadGeneration) throw new Error("已切换回放位置");
  video.dataset.segmentId = segment.id;
  video.dataset.timelineStartAt = source.timelineStartAt;
  video.dataset.videoOffsetSeconds = String(source.videoOffsetSeconds);
  if (autoplay) await video.play();
}

async function seekToTarget(targetAt: string): Promise<void> {
  const segment = findSegmentAt(targetAt);
  if (!segment) {
    updateMediaState("empty");
    errorMessage.value = "";
    return;
  }

  const generation = ++loadGeneration;
  errorMessage.value = "";
  updateMediaState("loading");

  try {
    await nextTick();
    await loadSegment(activeSlot.value, segment, targetAt, true);
    if (generation !== loadGeneration) return;
    activeSegmentId.value = segment.id;
    currentAbsoluteMs.value = new Date(targetAt).getTime();
    emit("time-update", targetAt);
    updateMediaState("playing");
    void preloadNext(segment);
  } catch (error) {
    if (generation !== loadGeneration) return;
    errorMessage.value = error instanceof Error ? error.message : "录像片段加载失败";
    updateMediaState("error");
  }
}

async function preloadNext(segment: RecordingSegment): Promise<void> {
  const next = findNextSegment(segment);
  if (!next || preloadingSegmentId === next.id) return;

  const standbySlot = getOtherSlot(activeSlot.value);
  const standby = getVideo(standbySlot);
  if (!standby || standby.dataset.segmentId === next.id) return;

  preloadingSegmentId = next.id;
  try {
    await loadSegment(standbySlot, next, next.startAt, false);
  } catch {
    // The active segment keeps playing; the next preload retries on the next timeupdate.
  } finally {
    if (preloadingSegmentId === next.id) preloadingSegmentId = "";
  }
}

async function switchToNext(slot: Slot): Promise<void> {
  if (slot !== activeSlot.value || switching) return;
  const currentSegment = sortedSegments.value.find((item) => item.id === activeSegmentId.value);
  if (!currentSegment) return;
  const next = findNextSegment(currentSegment);
  if (!next) {
    updateMediaState("ended");
    return;
  }

  switching = true;
  const nextSlot = getOtherSlot(slot);
  const nextVideo = getVideo(nextSlot);
  try {
    if (!nextVideo || nextVideo.dataset.segmentId !== next.id) {
      await loadSegment(nextSlot, next, next.startAt, false);
    }
    if (!nextVideo) return;
    await nextVideo.play();
    const previous = getVideo(slot);
    previous?.pause();
    activeSlot.value = nextSlot;
    activeSegmentId.value = next.id;
    currentAbsoluteMs.value = new Date(next.startAt).getTime();
    emit("time-update", next.startAt);
    updateMediaState("playing");
    void preloadNext(next);
  } catch {
    updateMediaState("buffering");
  } finally {
    switching = false;
  }
}

function handleTimeUpdate(slot: Slot): void {
  if (slot !== activeSlot.value) return;
  const video = getVideo(slot);
  const segment = sortedSegments.value.find((item) => item.id === activeSegmentId.value);
  if (!video || !segment) return;

  const absoluteAt = mapPlaybackVideoTime(
    {
      ...segment,
      startAt: video.dataset.timelineStartAt || segment.startAt,
      contentOffsetSeconds: Number(video.dataset.videoOffsetSeconds ?? segment.contentOffsetSeconds ?? 0),
    },
    video.currentTime,
  );
  currentAbsoluteMs.value = new Date(absoluteAt).getTime();
  emit("time-update", new Date(currentAbsoluteMs.value).toISOString());

  const remaining = video.duration - video.currentTime;
  if (Number.isFinite(remaining) && remaining <= 0.18) void switchToNext(slot);

  const next = findNextSegment(segment);
  const standby = getVideo(getOtherSlot(slot));
  if (next && standby?.dataset.segmentId !== next.id && remaining < 9) void preloadNext(segment);
}

function handlePlay(slot: Slot): void {
  if (slot === activeSlot.value) updateMediaState("playing");
}

function handlePause(slot: Slot): void {
  if (slot === activeSlot.value && mediaState.value !== "ended") updateMediaState("paused");
}

function handleWaiting(slot: Slot): void {
  if (slot === activeSlot.value) updateMediaState("buffering");
}

function handlePlaying(slot: Slot): void {
  if (slot === activeSlot.value) updateMediaState("playing");
}

function handleEnded(slot: Slot): void {
  void switchToNext(slot);
}

function handleError(slot: Slot): void {
  if (slot !== activeSlot.value) return;
  errorMessage.value = "录像片段读取失败，请检查媒体服务器连接";
  updateMediaState("error");
}

watch(
  () => props.targetAt,
  (targetAt) => {
    if (targetAt) void seekToTarget(targetAt);
  },
  { immediate: true },
);

watch(
  () => sortedSegments.value,
  (segments) => {
    if (!props.targetAt) {
      updateMediaState(segments.length ? "paused" : "empty");
      return;
    }
    if (!activeSegmentId.value) return;
    const segment = segments.find((item) => item.id === activeSegmentId.value);
    if (segment) void preloadNext(segment);
  },
);

onBeforeUnmount(() => {
  loadGeneration += 1;
  for (const slot of ["a", "b"] as const) {
    const video = getVideo(slot);
    if (!video) continue;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
});
</script>

<style scoped lang="scss">
.recording-player {
  position: relative;
  width: 100%;
  min-height: 0;
  aspect-ratio: 16 / 9;
  margin-top: 16px;
  overflow: hidden;
  color: #e8f3ef;
  background:
    radial-gradient(circle at 75% 20%, rgb(35 105 91 / 24%), transparent 32%),
    repeating-linear-gradient(0deg, transparent 0 39px, rgb(255 255 255 / 5%) 39px 40px), #062824;
}

.recording-player__video {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  pointer-events: none;
  object-fit: contain;
  opacity: 0;
  transition: opacity 180ms ease;

  &.is-active {
    z-index: 2;
    pointer-events: auto;
    opacity: 1;
  }
}

.recording-player__empty {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  gap: 8px;
  place-content: center;
  justify-items: center;
  padding: 24px;
  text-align: center;

  strong {
    font-size: 14px;
    font-weight: 650;
  }

  p {
    max-width: 420px;
    margin: 0;
    font-size: 10px;
    line-height: 1.7;
    color: #9db5ae;
  }
}

.recording-player__empty-signal {
  width: 38px;
  height: 26px;
  margin-bottom: 5px;
  background:
    linear-gradient(90deg, transparent 45%, #7fb7a7 45% 55%, transparent 55%),
    linear-gradient(#123f39, #123f39);
  border: 1px solid rgb(150 199 185 / 35%);
}

.recording-player__chrome {
  position: absolute;
  right: 14px;
  bottom: 48px;
  left: 14px;
  z-index: 4;
  display: flex;
  gap: 8px;
  align-items: center;
  pointer-events: none;

  strong {
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  small {
    margin-left: auto;
    font-size: 9px;
    color: #9bb6ae;
  }
}

.recording-player__mode {
  padding: 4px 6px;
  font-size: 9px;
  font-weight: 650;
  color: #a8d8c9;
  background: rgb(13 66 60 / 86%);
  border: 1px solid rgb(144 194 180 / 27%);
}

.recording-player[data-state="buffering"] .recording-player__mode,
.recording-player[data-state="loading"] .recording-player__mode {
  color: #f0c68f;
}

@media (width <= 640px) {
  .recording-player {
    min-height: 0;
    aspect-ratio: 16 / 9;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recording-player__video {
    transition: none;
  }
}
</style>
