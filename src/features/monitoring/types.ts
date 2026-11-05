export type CameraStatus = "ONLINE" | "OFFLINE" | "STALE";
export type SensorStatus = "ONLINE" | "OFFLINE" | "STALE" | "ALARM";
export type BedStatus = "AVAILABLE" | "OCCUPIED" | "CLEANING" | "OFFLINE";
export type PatientStatus = "STABLE" | "OBSERVATION" | "CRITICAL";
export type MonitoringRole = "NURSE" | "HEAD_NURSE" | "ADMIN" | "DEVELOPER";
export type StaffStatus = "ACTIVE" | "DISABLED";
export type PermissionModule =
  | "overview"
  | "beds"
  | "blankets"
  | "bindings"
  | "organization"
  | "staff"
  | "policy"
  | "video"
  | "mqtt"
  | "developer";
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
  patientAvatar?: string;
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
  latestData?: string;
  latestMetrics: SensorMetrics;
}

export interface SensorSnapshot {
  status?: SensorStatus;
  data?: string;
  observedAt?: string;
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
  mediaPath?: string;
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
  staff: StaffMember[];
}

export type MonitoringLookupData = Pick<
  MonitoringData,
  "beds" | "sensors" | "cameras" | "bindings"
> &
  Partial<Pick<MonitoringData, "hospital" | "wards" | "rooms">>;

export interface BedMonitorSummary {
  bed: Bed;
  ward: Ward | null;
  room: Room | null;
  sensor: SensorDevice | null;
  cameras: Camera[];
  bindingIds: string[];
  dataTopic: string | null;
  alarmTopic: string | null;
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

export interface BlanketInput {
  name: string;
  bedId: string;
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

export interface AddWardInput {
  code: string;
  name: string;
}

export interface UpdateWardInput {
  code: string;
  name: string;
}

export interface AddRoomInput {
  wardId: string;
  roomNo: string;
  name: string;
}

export interface UpdateRoomInput {
  roomNo: string;
  name: string;
}

export interface StaffMember {
  id: string;
  username: string;
  displayName: string;
  role: MonitoringRole;
  wardIds: string[];
  status: StaffStatus;
  passwordUpdatedAt?: string;
  modulePermissions?: PermissionModule[];
  tags?: string[];
}

export interface StaffInput {
  username: string;
  displayName: string;
  role: MonitoringRole;
  wardIds: string[];
  status: StaffStatus;
  initialPassword?: string;
  modulePermissions?: PermissionModule[];
  tags?: string[];
}

export interface CameraInput {
  cameraKey: string;
  mediaPath: string;
  name: string;
  vendor?: string;
  model?: string;
}

export interface ManagedCameraInput {
  name: string;
  bedId: string;
}

export interface MonitoringPolicy {
  clipBeforeSeconds: number;
  clipAfterSeconds: number;
  recordingRetentionMinutes: number;
}

export interface MqttSettings {
  brokerUrl: string;
  websocketUrl: string;
  clientId: string;
  username: string;
  password: string;
  alarmTopic: string;
  alarmTitleTemplate: string;
  alarmDetailTemplate: string;
  qos: 0 | 1 | 2;
}
