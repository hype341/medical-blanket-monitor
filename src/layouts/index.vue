<template>
  <div class="layout-wrapper">
    <component :is="currentLayoutComponent" />
    <Settings v-if="showSettings" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useMonitoringStore } from "@/features/monitoring/store";
import { openPlatformAlarmStream } from "@/features/monitoring/stream-api";
import { useLayout } from "./composables/useLayout";
import { useLayoutDevice } from "./composables/useLayoutDevice";
import { LayoutMode } from "@/enums/settings";
import type { AlarmEnvelope } from "@/features/monitoring/recording";
import LeftLayout from "./modes/LeftLayout.vue";
import TopLayout from "./modes/TopLayout.vue";
import MixLayout from "./modes/MixLayout.vue";
import DoubleLayout from "./modes/DoubleLayout.vue";
import Settings from "./components/LayoutSettings.vue";

const route = useRoute();
const { currentLayout, showSettings } = useLayout();
const monitoringStore = useMonitoringStore();
let alarmStream: ReturnType<typeof openPlatformAlarmStream> | null = null;
let alarmEventRevision = 0;

async function synchronizeAlarmSnapshot(capturedRevision: number): Promise<void> {
  try {
    const response = await fetch("/api/public/alarms", { cache: "no-store" });
    if (!response.ok || capturedRevision !== alarmEventRevision) return;
    const alarms = (await response.json()) as AlarmEnvelope[];
    if (Array.isArray(alarms) && capturedRevision === alarmEventRevision) {
      monitoringStore.replaceAlarms(alarms);
    }
  } catch {
    // A later WebSocket reconnect or page refresh will retry the snapshot.
  }
}

useLayoutDevice();

onMounted(() => {
  if (import.meta.env.VITE_MOCK_ENABLED === "true") return;
  alarmStream = openPlatformAlarmStream({
    onAlarm: (alarm) => {
      alarmEventRevision += 1;
      monitoringStore.ingestAlarm(alarm);
    },
    onDeleted: (alarmId) => {
      alarmEventRevision += 1;
      monitoringStore.removeAlarm(alarmId);
    },
    onStatus: (status) => {
      if (status === "connected") {
        const capturedRevision = alarmEventRevision;
        void synchronizeAlarmSnapshot(capturedRevision);
      }
    },
  });
});

onBeforeUnmount(() => {
  alarmStream?.close();
  alarmStream = null;
});

const currentLayoutComponent = computed(() => {
  const override = route.meta?.layout as LayoutMode | undefined;
  const layout = override ?? currentLayout.value;

  switch (layout) {
    case LayoutMode.TOP:
      return TopLayout;
    case LayoutMode.MIX:
      return MixLayout;
    case LayoutMode.DOUBLE:
      return DoubleLayout;
    default:
      return LeftLayout;
  }
});
</script>

<style lang="scss" scoped>
.layout-wrapper {
  width: 100%;
  height: 100%;
}
</style>
