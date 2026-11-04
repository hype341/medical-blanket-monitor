import type {
  Bed,
  Camera,
  DeviceBinding,
  MonitoringData,
  SensorDevice,
  StaffMember,
} from "./types";

const wards = [
  { id: "ward-a", hospitalId: "hospital-001", code: "WARD-A", name: "A 病区 · 外科" },
  { id: "ward-b", hospitalId: "hospital-001", code: "WARD-B", name: "B 病区 · 康复" },
];

const rooms = [
  { id: "room-a-301", wardId: "ward-a", roomNo: "301", name: "301 病房" },
  { id: "room-a-302", wardId: "ward-a", roomNo: "302", name: "302 病房" },
  { id: "room-a-303", wardId: "ward-a", roomNo: "303", name: "303 病房" },
  { id: "room-b-201", wardId: "ward-b", roomNo: "201", name: "201 病房" },
  { id: "room-b-202", wardId: "ward-b", roomNo: "202", name: "202 病房" },
  { id: "room-b-203", wardId: "ward-b", roomNo: "203", name: "203 病房" },
];

const beds: Bed[] = [
  {
    id: "bed-a-01",
    wardId: "ward-a",
    roomId: "room-a-301",
    bedNo: "01",
    patientName: "张桂兰",
    status: "OCCUPIED",
    updatedAt: "2026-11-04T16:52:00+08:00",
  },
  {
    id: "bed-a-02",
    wardId: "ward-a",
    roomId: "room-a-301",
    bedNo: "02",
    patientName: "王秀英",
    status: "OCCUPIED",
    updatedAt: "2026-11-04T16:52:10+08:00",
  },
  {
    id: "bed-a-03",
    wardId: "ward-a",
    roomId: "room-a-302",
    bedNo: "01",
    patientName: "李建国",
    status: "OCCUPIED",
    updatedAt: "2026-11-04T16:51:40+08:00",
  },
  {
    id: "bed-a-04",
    wardId: "ward-a",
    roomId: "room-a-302",
    bedNo: "02",
    status: "CLEANING",
    updatedAt: "2026-11-04T16:45:00+08:00",
  },
  {
    id: "bed-a-05",
    wardId: "ward-a",
    roomId: "room-a-303",
    bedNo: "01",
    patientName: "赵淑芬",
    status: "OCCUPIED",
    updatedAt: "2026-11-04T16:52:20+08:00",
  },
  {
    id: "bed-a-06",
    wardId: "ward-a",
    roomId: "room-a-303",
    bedNo: "02",
    status: "AVAILABLE",
    updatedAt: "2026-11-04T16:40:00+08:00",
  },
  {
    id: "bed-b-01",
    wardId: "ward-b",
    roomId: "room-b-201",
    bedNo: "01",
    patientName: "陈志强",
    status: "OCCUPIED",
    updatedAt: "2026-11-04T16:52:30+08:00",
  },
  {
    id: "bed-b-02",
    wardId: "ward-b",
    roomId: "room-b-201",
    bedNo: "02",
    patientName: "周美华",
    status: "OCCUPIED",
    updatedAt: "2026-11-04T16:52:35+08:00",
  },
  {
    id: "bed-b-03",
    wardId: "ward-b",
    roomId: "room-b-202",
    bedNo: "01",
    patientName: "孙海峰",
    status: "OCCUPIED",
    updatedAt: "2026-11-04T16:51:30+08:00",
  },
  {
    id: "bed-b-04",
    wardId: "ward-b",
    roomId: "room-b-203",
    bedNo: "01",
    patientName: "刘芳",
    status: "OCCUPIED",
    updatedAt: "2026-11-04T16:52:40+08:00",
  },
];

const sensors: SensorDevice[] = beds.map((bed, index) => ({
  id: `sensor-${bed.id}`,
  deviceKey: `blanket-${String(index + 1).padStart(3, "0")}`,
  name: `${bed.id.replace("bed-", "").toUpperCase()} 毯子传感器`,
  model: "MB-S1",
  status: "OFFLINE",
  latestMetrics: {},
}));

const cameras: Camera[] = [
  {
    id: "camera-01",
    cameraKey: "camera-ward-a-301",
    name: "301 病房摄像头",
    status: "ONLINE",
    playback: {
      cameraId: "camera-01",
      preferredProtocol: "webrtc",
      webrtcUrl: "http://10.208.236.131:8889/camera-01/whep",
      hlsUrl: "http://10.208.236.131:8888/camera-01/index.m3u8",
      flvUrl: null,
      expiresAt: "2099-12-31T23:59:59+08:00",
    },
  },
];

const bindings: DeviceBinding[] = [
  {
    id: "bind-a01-s",
    bedId: "bed-a-01",
    sensorDeviceId: "sensor-bed-a-01",
    cameraId: null,
    role: "PRIMARY_SENSOR",
    status: "ACTIVE",
  },
  {
    id: "bind-a01-c1",
    bedId: "bed-a-01",
    sensorDeviceId: null,
    cameraId: "camera-01",
    role: "PRIMARY_CAMERA",
    status: "ACTIVE",
  },
  {
    id: "bind-a02-s",
    bedId: "bed-a-02",
    sensorDeviceId: "sensor-bed-a-02",
    cameraId: null,
    role: "PRIMARY_SENSOR",
    status: "ACTIVE",
  },
  {
    id: "bind-a03-s",
    bedId: "bed-a-03",
    sensorDeviceId: "sensor-bed-a-03",
    cameraId: null,
    role: "PRIMARY_SENSOR",
    status: "ACTIVE",
  },
  {
    id: "bind-a04-s",
    bedId: "bed-a-04",
    sensorDeviceId: "sensor-bed-a-04",
    cameraId: null,
    role: "PRIMARY_SENSOR",
    status: "ACTIVE",
  },
  {
    id: "bind-a05-s",
    bedId: "bed-a-05",
    sensorDeviceId: "sensor-bed-a-05",
    cameraId: null,
    role: "PRIMARY_SENSOR",
    status: "ACTIVE",
  },
  {
    id: "bind-b01-s",
    bedId: "bed-b-01",
    sensorDeviceId: "sensor-bed-b-01",
    cameraId: null,
    role: "PRIMARY_SENSOR",
    status: "ACTIVE",
  },
  {
    id: "bind-b02-s",
    bedId: "bed-b-02",
    sensorDeviceId: "sensor-bed-b-02",
    cameraId: null,
    role: "PRIMARY_SENSOR",
    status: "ACTIVE",
  },
  {
    id: "bind-b03-s",
    bedId: "bed-b-03",
    sensorDeviceId: "sensor-bed-b-03",
    cameraId: null,
    role: "PRIMARY_SENSOR",
    status: "ACTIVE",
  },
  {
    id: "bind-b04-s",
    bedId: "bed-b-04",
    sensorDeviceId: "sensor-bed-b-04",
    cameraId: null,
    role: "PRIMARY_SENSOR",
    status: "ACTIVE",
  },
];

const staff: StaffMember[] = [
  {
    id: "staff-admin",
    username: "admin",
    displayName: "系统管理员",
    role: "ADMIN",
    wardIds: ["ward-a", "ward-b"],
    status: "ACTIVE",
    passwordUpdatedAt: "2026-11-01T09:00:00+08:00",
  },
  {
    id: "staff-nurse",
    username: "nurse",
    displayName: "值班护士",
    role: "NURSE",
    wardIds: ["ward-a"],
    status: "ACTIVE",
    passwordUpdatedAt: "2026-11-01T09:00:00+08:00",
  },
  {
    id: "staff-head-nurse",
    username: "head-nurse",
    displayName: "A 病区护士长",
    role: "HEAD_NURSE",
    wardIds: ["ward-a"],
    status: "ACTIVE",
    passwordUpdatedAt: "2026-11-01T09:00:00+08:00",
  },
  {
    id: "staff-developer",
    username: "developer",
    displayName: "系统开发者",
    role: "DEVELOPER",
    wardIds: ["ward-a", "ward-b"],
    status: "ACTIVE",
    passwordUpdatedAt: "2026-11-01T09:00:00+08:00",
  },
];

export function createMonitoringFixture(): MonitoringData {
  return {
    hospital: {
      id: "hospital-001",
      code: "H001",
      name: "康宁医院",
    },
    wards: structuredClone(wards),
    rooms: structuredClone(rooms),
    beds: structuredClone(beds),
    sensors: structuredClone(sensors),
    cameras: structuredClone(cameras),
    bindings: structuredClone(bindings),
    staff: structuredClone(staff),
  };
}
