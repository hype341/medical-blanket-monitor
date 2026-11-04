import type {
  BedFilters,
  BedMonitorSummary,
  CameraPlayback,
  MonitoringLookupData,
  PlaybackProtocol,
} from "./types";
import { buildBedMqttTopics } from "./messaging";

export function getBedMonitorSummary(
  bedId: string,
  data: MonitoringLookupData,
): BedMonitorSummary | null {
  const bed = data.beds.find((item) => item.id === bedId);
  if (!bed) return null;

  const activeBindings = data.bindings.filter(
    (binding) => binding.bedId === bedId && binding.status === "ACTIVE",
  );
  const sensorBinding = activeBindings.find((binding) => binding.role === "PRIMARY_SENSOR");
  const sensor = sensorBinding?.sensorDeviceId
    ? (data.sensors.find((item) => item.id === sensorBinding.sensorDeviceId) ?? null)
    : null;
  const cameraBindings = activeBindings
    .filter((binding) => binding.role !== "PRIMARY_SENSOR" && binding.cameraId)
    .sort((left, right) => {
      if (left.role === right.role) return 0;
      return left.role === "PRIMARY_CAMERA" ? -1 : 1;
    });
  const cameras = cameraBindings
    .map((binding) => data.cameras.find((camera) => camera.id === binding.cameraId))
    .filter((camera) => camera !== undefined);

  const ward = data.wards?.find((item) => item.id === bed.wardId) ?? null;
  const room = data.rooms?.find((item) => item.id === bed.roomId) ?? null;
  const topics =
    sensor && ward && room
      ? buildBedMqttTopics({
          hospitalCode: data.hospital?.code ?? "H001",
          wardCode: ward.code,
          roomNo: room.roomNo,
          bedNo: bed.bedNo,
          deviceKey: sensor.deviceKey,
        })
      : null;

  return {
    bed,
    ward,
    room,
    sensor,
    cameras,
    bindingIds: activeBindings.map((binding) => binding.id),
    telemetryTopic: topics?.telemetry ?? null,
    alarmTopic: topics?.alarm ?? null,
  };
}

export function selectPlaybackProtocol(playback: CameraPlayback): PlaybackProtocol | null {
  if (playback.webrtcUrl) return "webrtc";
  if (playback.hlsUrl) return "hls";
  if (playback.flvUrl) return "flv";
  return null;
}

export function filterBedSummaries(
  summaries: BedMonitorSummary[],
  filters: BedFilters,
): BedMonitorSummary[] {
  const query = filters.query?.trim().toLowerCase();

  return summaries.filter((summary) => {
    if (filters.wardId && summary.bed.wardId !== filters.wardId) return false;
    if (filters.roomId && summary.bed.roomId !== filters.roomId) return false;
    if (filters.status && filters.status !== "ALL" && summary.bed.status !== filters.status) {
      return false;
    }
    if (!query) return true;

    return [
      summary.bed.bedNo,
      summary.bed.patientName,
      summary.room?.roomNo,
      summary.room?.name,
      summary.ward?.name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}
