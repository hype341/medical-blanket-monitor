export type CameraStatus = "ONLINE" | "OFFLINE" | "STALE";
export type SensorStatus = "ONLINE" | "OFFLINE" | "STALE" | "ALARM";
export type BedStatus = "AVAILABLE" | "OCCUPIED" | "CLEANING" | "OFFLINE";
export type PatientStatus = "STABLE" | "OBSERVATION" | "CRITICAL";
export type MonitoringRole = "NURSE" | "ADMIN";
export type BindingRole = "PRIMARY_SENSOR" | "PRIMARY_CAMERA";
export type BindingStatus = "ACTIVE" | "INACTIVE";
export type PlaybackProtocol = "webrtc" | "hls" | "flv";
export type MetricValue = number | string | boolean;
export type SensorMetrics = Record<string, MetricValue>;

export interface Hospital {
  id: string;
  code: string;
  name: string;
}

export interface Ward {
  id: string;
  hospitalId: string;
  code: string;
  name: string;
}

export interface Room {
  id: string;
  wardId: string;
  roomNo: string;
  name: string;
}

export interface Bed {
  id: string;
  wardId: string;
  roomId: string;
  bedNo: string;
  patientName?: string;
  patientNo?: string;
  patientStatus?: PatientStatus;
  lastEditedBy?: MonitoringRole;
  lastEditedAt?: string;
  status: BedStatus;
  updatedAt: string;
}

export interface SensorDevice {
  id: string;
  deviceKey: string;
  name: string;
  model?: string;
  status: SensorStatus;
  lastSeenAt?: string;
  latestMetrics: SensorMetrics;
}

export interface CameraPlayback {
  cameraId: string;
  preferredProtocol: PlaybackProtocol;
  webrtcUrl: string | null;
  hlsUrl: string | null;
  flvUrl: string | null;
  expiresAt: string;
}

export interface Camera {
  id: string;
  cameraKey: string;
  name: string;
  vendor?: string;
  model?: string;
  status: CameraStatus;
  playback: CameraPlayback | null;
}

export interface DeviceBinding {
  id: string;
  bedId: string;
  sensorDeviceId: string | null;
  cameraId: string | null;
  role: BindingRole;
  status: BindingStatus;
  activeFrom?: string;
  activeTo?: string;
}

export interface MonitoringData {
  hospital: Hospital;
  wards: Ward[];
  rooms: Room[];
  beds: Bed[];
  sensors: SensorDevice[];
  cameras: Camera[];
  bindings: DeviceBinding[];
}

export type MonitoringLookupData = Omit<MonitoringData, "hospital" | "wards" | "rooms"> &
  Partial<Pick<MonitoringData, "hospital" | "wards" | "rooms">>;

export interface BedMonitorSummary {
  bed: Bed;
  ward: Ward | null;
  room: Room | null;
  sensor: SensorDevice | null;
  cameras: Camera[];
  bindingIds: string[];
}

export interface BedFilters {
  wardId?: string;
  roomId?: string;
  status?: BedStatus | "ALL";
  query?: string;
}

export interface BindingInput {
  bedId: string;
  sensorDeviceId: string | null;
  cameraId: string | null;
}

export interface AddBedInput {
  wardId: string;
  roomId: string;
  bedNo: string;
  patientName?: string;
}

export interface PatientUpdateInput {
  patientName: string;
  patientNo: string;
  patientStatus: PatientStatus;
  bedStatus: BedStatus;
  wardId?: string;
  roomId?: string;
  bedNo?: string;
}
