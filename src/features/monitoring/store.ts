import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { ElNotification } from "element-plus";
import { createMonitoringFixture } from "./mock-data";
import { canManageRole, defaultModulesForRole } from "./permissions";
import type { AlarmEnvelope } from "./recording";
import { buildBedMonitorSummaries, getBedMonitorSummary } from "./selectors";
import { normalizeHexData } from "./processing";
import type {
  AddBedInput,
  BlanketInput,
  AddRoomInput,
  AddWardInput,
  BindingInput,
  Camera,
  CameraInput,
  DeviceBinding,
  MonitoringData,
  MonitoringPolicy,
  MonitoringRole,
  MqttSettings,
  ManagedCameraInput,
  PermissionModule,
  PatientUpdateInput,
  SensorDevice,
  SensorSnapshot,
  StaffInput,
  UpdateRoomInput,
  UpdateWardInput,
} from "./types";
import {
  exportStaffCredentials,
  removeStaffCredential,
  restoreStaffCredentials,
  type StoredCredential,
} from "./staff-credentials";

function loadStoredAlarms(): AlarmEnvelope[] {
  try {
    const value = JSON.parse(sessionStorage.getItem("monitoring-alarms") ?? "[]") as unknown;
    return Array.isArray(value) ? (value as AlarmEnvelope[]) : [];
  } catch {
    return [];
  }
}

const MQTT_SETTINGS_KEY = "monitoring-mqtt-settings";
const PLATFORM_NAME_KEY = "monitoring-platform-name";
const STAFF_TAGS_KEY = "monitoring-staff-tags";
const MODULE_MIGRATION_KEY = "monitoring-module-schema";
const MONITORING_DATA_KEY = "monitoring-business-data";
const MONITORING_POLICY_KEY = "monitoring-policy";
const DATA_SCHEMA_VERSION = 1;
const DEFAULT_PLATFORM_NAME = "医用智能毯安全监护平台";
const DEFAULT_STAFF_TAGS = ["责任护士", "夜班", "实习"];
const DEFAULT_MQTT_SETTINGS: MqttSettings = {
  brokerUrl: "mqtt://10.208.236.217:1883",
  websocketUrl: "ws://10.208.236.217:8083/mqtt",
  clientId: "medical-blanket-platform",
  username: "blanket-service",
  password: "demo-mqtt-secret",
  alarmTopic: "medical-blanket/v1/+/+/+/alarm",
  alarmTitleTemplate: "{{deviceName}} 状态异常",
  alarmDetailTemplate: "{{bedName}} 在 {{occurredAt}} 上报 {{alarmCode}}",
  qos: 1,
};
const DEFAULT_MONITORING_POLICY: MonitoringPolicy = {
  clipBeforeSeconds: 30,
  clipAfterSeconds: 60,
  recordingRetentionMinutes: 1_440,
};

interface StoredMonitoringData {
  schemaVersion: number;
  data: MonitoringData;
}

export interface MonitoringBackup {
  schemaVersion: number;
  exportedAt: string;
  platformName: string;
  data: MonitoringData;
  monitoringPolicy: MonitoringPolicy;
  mqttSettings: Omit<MqttSettings, "password">;
  staffTags: string[];
  staffCredentials?: Record<string, StoredCredential>;
}

function isMonitoringData(value: unknown): value is MonitoringData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MonitoringData>;
  return Boolean(
    candidate.hospital &&
      Array.isArray(candidate.wards) &&
      Array.isArray(candidate.rooms) &&
      Array.isArray(candidate.beds) &&
      Array.isArray(candidate.sensors) &&
      Array.isArray(candidate.cameras) &&
      Array.isArray(candidate.bindings) &&
      Array.isArray(candidate.staff),
  );
}

function loadMonitoringData(): MonitoringData | null {
  try {
    const stored = JSON.parse(localStorage.getItem(MONITORING_DATA_KEY) ?? "null") as unknown;
    if (!stored || typeof stored !== "object") return null;
    const payload = stored as Partial<StoredMonitoringData>;
    return payload.schemaVersion === DATA_SCHEMA_VERSION && isMonitoringData(payload.data)
      ? structuredClone(payload.data)
      : null;
  } catch {
    return null;
  }
}

function loadMonitoringPolicy(): MonitoringPolicy {
  try {
    const stored = JSON.parse(
      localStorage.getItem(MONITORING_POLICY_KEY) ?? "null",
    ) as Partial<MonitoringPolicy> | null;
    if (!stored) return { ...DEFAULT_MONITORING_POLICY };
    return {
      clipBeforeSeconds: Math.max(1, Number(stored.clipBeforeSeconds) || 30),
      clipAfterSeconds: Math.max(1, Number(stored.clipAfterSeconds) || 60),
      recordingRetentionMinutes: Math.max(
        1,
        Number(stored.recordingRetentionMinutes) || 1_440,
      ),
    };
  } catch {
    return { ...DEFAULT_MONITORING_POLICY };
  }
}

function loadMqttSettings(): MqttSettings {
  try {
    const value = JSON.parse(localStorage.getItem(MQTT_SETTINGS_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object") return { ...DEFAULT_MQTT_SETTINGS };
    const restored = { ...DEFAULT_MQTT_SETTINGS, ...(value as Partial<MqttSettings>) };
    if (restored.alarmTopic === "medical-blanket/v1/+/+/+/+/alarm") {
      restored.alarmTopic = DEFAULT_MQTT_SETTINGS.alarmTopic;
    }
    return restored;
  } catch {
    return { ...DEFAULT_MQTT_SETTINGS };
  }
}

function loadStaffTags(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STAFF_TAGS_KEY) ?? "null") as unknown;
    return Array.isArray(value)
      ? value.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim()))
      : [...DEFAULT_STAFF_TAGS];
  } catch {
    return [...DEFAULT_STAFF_TAGS];
  }
}

export const useMonitoringStore = defineStore("monitoring", () => {
  const fixture = ref<MonitoringData>(loadMonitoringData() ?? createMonitoringFixture());
  const platformName = ref(localStorage.getItem(PLATFORM_NAME_KEY) || DEFAULT_PLATFORM_NAME);
  if (typeof document !== "undefined") document.title = platformName.value;
  const storedHospitalName = localStorage.getItem("monitoring-hospital-name");
  if (storedHospitalName) fixture.value.hospital.name = storedHospitalName;
  const storedWardIds = sessionStorage.getItem("monitoring-wards");
  const currentWardIds = ref<string[]>(
    storedWardIds ? (JSON.parse(storedWardIds) as string[]) : ["ward-a", "ward-b"],
  );
  const storedRole = sessionStorage.getItem("monitoring-role");
  const activeRole = ref<MonitoringRole>(
    storedRole === "NURSE" ||
      storedRole === "HEAD_NURSE" ||
      storedRole === "ADMIN" ||
      storedRole === "DEVELOPER"
      ? storedRole
      : "ADMIN",
  );
  const alarms = ref<AlarmEnvelope[]>(loadStoredAlarms());
  const staffTags = ref<string[]>(loadStaffTags());
  let alarmPersistTimer: ReturnType<typeof setTimeout> | null = null;
  watch(
    alarms,
    (value) => {
      const serialized = JSON.stringify(value);
      if (alarmPersistTimer) clearTimeout(alarmPersistTimer);
      alarmPersistTimer = setTimeout(() => {
        sessionStorage.setItem("monitoring-alarms", serialized);
        alarmPersistTimer = null;
      }, 250);
    },
    { deep: true },
  );
  const monitoringPolicy = ref<MonitoringPolicy>(loadMonitoringPolicy());
  const mqttSettings = ref<MqttSettings>(loadMqttSettings());
  let bindingSequence = 100;
  let bedSequence = 100;
  let blanketSequence = 100;
  let wardSequence = 100;
  let roomSequence = 100;
  let staffSequence = 100;
  let cameraSequence = 100;
  const alarmNotificationTimes = new Map<string, number>();
  let dataPersistTimer: ReturnType<typeof setTimeout> | null = null;
  let dataPersistIdle: number | null = null;
  const { hospital, wards, rooms, beds, sensors, cameras, bindings, staff } = fixture.value;
  if (activeRole.value === "ADMIN" || activeRole.value === "DEVELOPER") {
    currentWardIds.value = wards.map((ward) => ward.id);
    sessionStorage.setItem("monitoring-wards", JSON.stringify(currentWardIds.value));
  }

  function nextSequence(values: string[], pattern: RegExp, minimum = 100): number {
    const highest = values.reduce((current, value) => {
      const match = value.match(pattern);
      return match ? Math.max(current, Number(match[1]) || 0) : current;
    }, 0);
    return Math.max(minimum, highest + 1);
  }

  function refreshSequences(): void {
    wardSequence = nextSequence(
      wards.map((ward) => ward.id),
      /^ward-(\d+)$/,
    );
    roomSequence = nextSequence(
      rooms.map((room) => room.id),
      /^room-(\d+)$/,
    );
    bedSequence = nextSequence(
      beds.map((bed) => bed.id),
      /(\d+)$/,
    );
    bindingSequence = nextSequence(
      bindings.map((binding) => binding.id),
      /(\d+)$/,
    );
    blanketSequence = nextSequence(
      sensors.filter((sensor) => sensor.id.startsWith("sensor-blanket-")).map((sensor) => sensor.id),
      /(\d+)$/,
    );
    staffSequence = nextSequence(
      staff.map((member) => member.id),
      /(\d+)$/,
    );
    cameraSequence = nextSequence(
      cameras.map((camera) => camera.id),
      /(\d+)$/,
    );
  }

  refreshSequences();

  watch(
    fixture,
    (value) => {
      if (dataPersistTimer) clearTimeout(dataPersistTimer);
      if (dataPersistIdle !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(dataPersistIdle);
      }
      const persist = () => {
        try {
          const serialized = JSON.stringify({
            schemaVersion: DATA_SCHEMA_VERSION,
            data: value,
          } satisfies StoredMonitoringData);
          localStorage.setItem(MONITORING_DATA_KEY, serialized);
        } catch {
          // Keep the live platform usable if browser storage quota is unavailable.
        } finally {
          dataPersistTimer = null;
          dataPersistIdle = null;
        }
      };
      if ("requestIdleCallback" in window) {
        dataPersistIdle = window.requestIdleCallback(persist, { timeout: 1_500 });
      } else {
        dataPersistTimer = setTimeout(persist, 600);
      }
    },
    { deep: true },
  );
  watch(
    monitoringPolicy,
    (value) => {
      localStorage.setItem(MONITORING_POLICY_KEY, JSON.stringify(value));
    },
    { deep: true },
  );
  if (!localStorage.getItem(MONITORING_DATA_KEY)) {
    try {
      localStorage.setItem(
        MONITORING_DATA_KEY,
        JSON.stringify({ schemaVersion: DATA_SCHEMA_VERSION, data: fixture.value }),
      );
    } catch {
      // The platform remains usable when private browsing disables persistent storage.
    }
  }

  const activeUsername = ref(sessionStorage.getItem("monitoring-username") ?? "");
  const storedModules = sessionStorage.getItem("monitoring-modules");
  const activeModulePermissions = ref<PermissionModule[]>(
    storedModules
      ? (JSON.parse(storedModules) as PermissionModule[])
      : defaultModulesForRole(activeRole.value),
  );
  if (
    (activeRole.value === "ADMIN" || activeRole.value === "DEVELOPER") &&
    localStorage.getItem(MODULE_MIGRATION_KEY) !== "3"
  ) {
    activeModulePermissions.value = Array.from(
      new Set([...activeModulePermissions.value, "blankets", "video"]),
    );
    if (activeRole.value === "DEVELOPER") {
      activeModulePermissions.value = Array.from(
        new Set([...activeModulePermissions.value, "mqtt", "maintenance", "developer"]),
      );
    }
    const developer = staff.find((member) => member.role === "DEVELOPER");
    if (developer?.modulePermissions && !developer.modulePermissions.includes("maintenance")) {
      developer.modulePermissions.push("maintenance");
    }
    sessionStorage.setItem("monitoring-modules", JSON.stringify(activeModulePermissions.value));
    localStorage.setItem(MODULE_MIGRATION_KEY, "3");
  }

  const currentWards = computed(() =>
    wards.filter((ward) => currentWardIds.value.includes(ward.id)),
  );

  const visibleBeds = computed(() =>
    beds
      .filter((bed) => currentWardIds.value.includes(bed.wardId))
      .sort((left, right) => {
        if (left.wardId !== right.wardId) return left.wardId.localeCompare(right.wardId);
        if (left.roomId !== right.roomId) return left.roomId.localeCompare(right.roomId);
        return left.bedNo.localeCompare(right.bedNo);
      }),
  );

  const bedSummaries = computed(() =>
    buildBedMonitorSummaries(fixture.value)
      .filter((summary) => currentWardIds.value.includes(summary.bed.wardId))
      .sort((left, right) => {
        if (left.bed.wardId !== right.bed.wardId)
          return left.bed.wardId.localeCompare(right.bed.wardId);
        if (left.bed.roomId !== right.bed.roomId)
          return left.bed.roomId.localeCompare(right.bed.roomId);
        return left.bed.bedNo.localeCompare(right.bed.bedNo);
      }),
  );
  const openAlarmCount = computed(() => {
    const visibleBedIds = new Set(visibleBeds.value.map((bed) => bed.id));
    return alarms.value.filter(
      (alarm) => alarm.status === "OPEN" && visibleBedIds.has(alarm.bedId),
    ).length;
  });
  const unboundBedCount = computed(
    () =>
      bedSummaries.value.filter(
        (summary) => !summary.sensor || summary.cameras.length === 0,
      ).length,
  );
  const isPlatformManager = computed(
    () => activeRole.value === "ADMIN" || activeRole.value === "DEVELOPER",
  );
  const canManageBindings = computed(() => isPlatformManager.value);
  const canManageOrganization = computed(() => isPlatformManager.value);
  const canManageStaff = computed(() => isPlatformManager.value);
  const canManageCameras = computed(() => activeRole.value === "DEVELOPER");
  const canManagePolicy = computed(() => isPlatformManager.value);
  const canViewConnections = computed(() => activeRole.value === "DEVELOPER");
  const canViewDeveloperConsole = computed(() => activeRole.value === "DEVELOPER");

  function getBedBindings(bedId: string): DeviceBinding[] {
    return bindings.filter((binding) => binding.bedId === bedId && binding.status === "ACTIVE");
  }

  function updateBinding(input: BindingInput): void {
    if (!canManageBindings.value) {
      throw new Error("仅管理员或开发者可以修改设备绑定");
    }

    const now = new Date().toISOString();
    const nextBindings = bindings.map((binding) =>
      binding.bedId === input.bedId && binding.status === "ACTIVE"
        ? { ...binding, status: "INACTIVE" as const, activeTo: now }
        : binding,
    );

    if (input.sensorDeviceId) {
      nextBindings.push({
        id: `binding-${bindingSequence++}`,
        bedId: input.bedId,
        sensorDeviceId: input.sensorDeviceId,
        cameraId: null,
        role: "PRIMARY_SENSOR",
        status: "ACTIVE",
        activeFrom: now,
      });
    }

    if (input.cameraId) {
      nextBindings.push({
        id: `binding-${bindingSequence++}`,
        bedId: input.bedId,
        sensorDeviceId: null,
        cameraId: input.cameraId,
        role: "PRIMARY_CAMERA",
        status: "ACTIVE",
        activeFrom: now,
      });
    }

    bindings.splice(0, bindings.length, ...nextBindings);
  }

  function setCurrentWardIds(wardIds: string[]): void {
    const resolvedWardIds =
      activeRole.value === "ADMIN" || activeRole.value === "DEVELOPER"
        ? wards.map((ward) => ward.id)
        : wardIds;
    currentWardIds.value = [...resolvedWardIds];
    sessionStorage.setItem("monitoring-wards", JSON.stringify(currentWardIds.value));
  }

  function updateHospitalName(name: string): void {
    if (activeRole.value !== "DEVELOPER") {
      throw new Error("仅开发者可以修改医院名称");
    }
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error("医院名称不能为空");
    hospital.name = normalizedName;
    localStorage.setItem("monitoring-hospital-name", normalizedName);
  }

  function updatePlatformName(name: string): void {
    if (activeRole.value !== "DEVELOPER") {
      throw new Error("仅开发者可以修改平台名称");
    }
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error("平台名称不能为空");
    platformName.value = normalizedName;
    localStorage.setItem(PLATFORM_NAME_KEY, normalizedName);
    document.title = normalizedName;
  }

  function setActiveRole(role: MonitoringRole, username?: string): void {
    activeRole.value = role;
    activeUsername.value = username ?? "";
    sessionStorage.setItem("monitoring-role", role);
    if (username) sessionStorage.setItem("monitoring-username", username);
    const member = username
      ? staff.find((item) => item.username === username)
      : staff.find((item) => item.role === role);
    activeModulePermissions.value = [...(member?.modulePermissions ?? defaultModulesForRole(role))];
    sessionStorage.setItem("monitoring-modules", JSON.stringify(activeModulePermissions.value));
  }

  function canAccessModule(module: PermissionModule): boolean {
    return activeModulePermissions.value.includes(module);
  }

  function assertOrganizationAdmin(): void {
    if (!canManageOrganization.value) {
      throw new Error("仅管理员可以管理病区和病房");
    }
  }

  function addWard(input: AddWardInput): string {
    assertOrganizationAdmin();
    if (wards.some((ward) => ward.code === input.code.trim())) {
      throw new Error("病区编码已存在");
    }
    const wardId = `ward-${wardSequence++}`;
    wards.push({
      id: wardId,
      hospitalId: hospital.id,
      code: input.code.trim(),
      name: input.name.trim(),
    });
    if (activeRole.value === "ADMIN" || activeRole.value === "DEVELOPER") {
      setCurrentWardIds([...currentWardIds.value, wardId]);
    }
    return wardId;
  }

  function updateWard(wardId: string, input: UpdateWardInput): void {
    assertOrganizationAdmin();
    const ward = wards.find((item) => item.id === wardId);
    if (!ward) throw new Error("病区不存在");
    ward.code = input.code.trim();
    ward.name = input.name.trim();
  }

  function addRoom(input: AddRoomInput): string {
    assertOrganizationAdmin();
    const duplicate = rooms.some(
      (room) => room.wardId === input.wardId && room.roomNo === input.roomNo.trim(),
    );
    if (duplicate) throw new Error("该病区已存在相同房号");
    const roomId = `room-${roomSequence++}`;
    rooms.push({
      id: roomId,
      wardId: input.wardId,
      roomNo: input.roomNo.trim(),
      name: input.name.trim(),
    });
    return roomId;
  }

  function updateRoom(roomId: string, input: UpdateRoomInput): void {
    assertOrganizationAdmin();
    const room = rooms.find((item) => item.id === roomId);
    if (!room) throw new Error("病房不存在");
    room.roomNo = input.roomNo.trim();
    room.name = input.name.trim();
  }

  function deleteRoom(roomId: string): void {
    assertOrganizationAdmin();
    if (beds.some((bed) => bed.roomId === roomId)) {
      throw new Error("该病房还有床位，请先删除或迁移床位");
    }
    const index = rooms.findIndex((room) => room.id === roomId);
    if (index < 0) throw new Error("病房不存在");
    rooms.splice(index, 1);
  }

  function deleteWard(wardId: string): void {
    assertOrganizationAdmin();
    if (
      rooms.some((room) => room.wardId === wardId) ||
      beds.some((bed) => bed.wardId === wardId)
    ) {
      throw new Error("该病区还有病房或床位，不能直接删除");
    }
    const index = wards.findIndex((ward) => ward.id === wardId);
    if (index < 0) throw new Error("病区不存在");
    wards.splice(index, 1);
    currentWardIds.value = currentWardIds.value.filter((id) => id !== wardId);
    sessionStorage.setItem("monitoring-wards", JSON.stringify(currentWardIds.value));
  }

  function addStaff(input: StaffInput): string {
    if (!canManageStaff.value) {
      throw new Error("仅管理员可以管理人员权限");
    }
    if (!canManageRole(activeRole.value, input.role)) {
      throw new Error("只能创建级别低于自己的账号");
    }
    const requestedModules = input.modulePermissions ?? defaultModulesForRole(input.role);
    if (!requestedModules.every((module) => activeModulePermissions.value.includes(module))) {
      throw new Error("只能授予自己拥有的模块权限");
    }
    if (!input.wardIds.every((wardId) => currentWardIds.value.includes(wardId))) {
      throw new Error("只能授予自己已授权的病区");
    }
    if (staff.some((item) => item.username === input.username.trim())) {
      throw new Error("登录账号已存在");
    }
    if (!input.initialPassword || input.initialPassword.length < 6) {
      throw new Error("初始密码不能少于 6 位");
    }
    const staffId = `staff-${staffSequence++}`;
    const tags = normalizeStaffTags(input.tags);
    staff.push({
      id: staffId,
      username: input.username.trim(),
      displayName: input.displayName.trim(),
      role: input.role,
      wardIds: [...input.wardIds],
      status: input.status,
      passwordUpdatedAt: new Date().toISOString(),
      modulePermissions: [...requestedModules],
      tags,
    });
    return staffId;
  }

  function updateStaff(staffId: string, input: StaffInput): void {
    if (!canManageStaff.value) {
      throw new Error("仅管理员可以管理人员权限");
    }
    const member = staff.find((item) => item.id === staffId);
    if (!member) throw new Error("人员不存在");
    if (!canManageRole(activeRole.value, member.role)) {
      throw new Error("只能管理级别低于自己的账号");
    }
    if (!canManageRole(activeRole.value, input.role)) {
      throw new Error("不能把账号提升到与当前账号同级或更高");
    }
    const requestedModules = input.modulePermissions ?? [
      ...(member.modulePermissions ?? defaultModulesForRole(member.role)),
    ];
    if (!requestedModules.every((module) => activeModulePermissions.value.includes(module))) {
      throw new Error("只能授予自己拥有的模块权限");
    }
    if (!input.wardIds.every((wardId) => currentWardIds.value.includes(wardId))) {
      throw new Error("只能授予自己已授权的病区");
    }
    member.username = input.username.trim();
    member.displayName = input.displayName.trim();
    member.role = input.role;
    member.wardIds = [...input.wardIds];
    member.status = input.status;
    member.modulePermissions = [...requestedModules];
    member.tags = normalizeStaffTags(input.tags);
    if (input.initialPassword) {
      if (input.initialPassword.length < 6) {
        throw new Error("新密码不能少于 6 位");
      }
      member.passwordUpdatedAt = new Date().toISOString();
    }
  }

  function deleteStaff(staffId: string): void {
    if (!canManageMember(staffId)) {
      throw new Error("只能删除级别低于自己的账号");
    }
    const index = staff.findIndex((item) => item.id === staffId);
    if (index < 0) throw new Error("人员不存在");
    staff.splice(index, 1);
    removeStaffCredential(staffId);
  }

  function addStaffTag(name: string): void {
    if (!canManageStaff.value) throw new Error("仅管理员或开发者可以管理角色标签");
    const normalized = name.trim().replace(/\s+/g, " ");
    if (!normalized) throw new Error("角色标签不能为空");
    if (!staffTags.value.includes(normalized)) {
      staffTags.value.push(normalized);
      localStorage.setItem(STAFF_TAGS_KEY, JSON.stringify(staffTags.value));
    }
  }

  function deleteStaffTag(tag: string): void {
    if (!canManageStaff.value) throw new Error("仅管理员或开发者可以管理角色标签");
    staffTags.value = staffTags.value.filter((item) => item !== tag);
    for (const member of staff) {
      member.tags = member.tags?.filter((item) => item !== tag);
    }
    localStorage.setItem(STAFF_TAGS_KEY, JSON.stringify(staffTags.value));
  }

  function normalizeStaffTags(values: string[] | undefined): string[] {
    const tags = Array.from(
      new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
    );
    for (const tag of tags) {
      if (!staffTags.value.includes(tag)) staffTags.value.push(tag);
    }
    if (tags.length) localStorage.setItem(STAFF_TAGS_KEY, JSON.stringify(staffTags.value));
    return tags;
  }

  function addCamera(input: CameraInput): string {
    if (!canManageCameras.value) {
      throw new Error("仅开发者可以管理摄像头");
    }
    if (cameras.some((item) => item.cameraKey === input.cameraKey.trim())) {
      throw new Error("摄像头标识已存在");
    }
    if (cameras.some((item) => item.mediaPath === input.mediaPath.trim())) {
      throw new Error("媒体路径已存在");
    }
    const cameraId = `camera-${cameraSequence++}`;
    cameras.push({
      id: cameraId,
      cameraKey: input.cameraKey.trim(),
      mediaPath: input.mediaPath.trim(),
      mediaServerUrl: normalizeMediaServerUrl(input.mediaServerUrl),
      name: input.name.trim(),
      vendor: input.vendor?.trim() || undefined,
      model: input.model?.trim() || undefined,
      status: "OFFLINE",
      playback: null,
    });
    return cameraId;
  }

  function addManagedCamera(input: ManagedCameraInput): string {
    assertCameraMetadataManager();
    const bed = beds.find((item) => item.id === input.bedId);
    if (!bed) throw new Error("关联床位不存在");
    const name = input.name.trim();
    if (!name) throw new Error("摄像头名称不能为空");
    const sequence = cameraSequence++;
    const cameraId = `camera-${sequence}`;
    const key = `camera-directory-${sequence}`;
    cameras.push({
      id: cameraId,
      cameraKey: key,
      mediaPath: key,
      name,
      status: "OFFLINE",
      playback: null,
    });
    bindCameraToBed(cameraId, bed.id);
    return cameraId;
  }

  function updateManagedCamera(cameraId: string, input: ManagedCameraInput): void {
    assertCameraMetadataManager();
    const camera = cameras.find((item) => item.id === cameraId);
    if (!camera) throw new Error("摄像头不存在");
    const bed = beds.find((item) => item.id === input.bedId);
    if (!bed) throw new Error("关联床位不存在");
    const name = input.name.trim();
    if (!name) throw new Error("摄像头名称不能为空");
    camera.name = name;
    const currentBinding = bindings.find(
      (item) =>
        item.cameraId === cameraId &&
        item.role === "PRIMARY_CAMERA" &&
        item.status === "ACTIVE",
    );
    if (!currentBinding || currentBinding.bedId !== bed.id) {
      bindCameraToBed(cameraId, bed.id);
    }
  }

  function assertCameraMetadataManager(): void {
    if (!isPlatformManager.value) throw new Error("仅管理员或开发者可以管理摄像头");
  }

  function bindCameraToBed(cameraId: string, bedId: string): void {
    const now = new Date().toISOString();
    for (const binding of bindings) {
      if (binding.status !== "ACTIVE" || binding.role !== "PRIMARY_CAMERA") continue;
      if (binding.bedId === bedId || binding.cameraId === cameraId) {
        binding.status = "INACTIVE";
        binding.activeTo = now;
      }
    }
    bindings.push({
      id: `binding-${bindingSequence++}`,
      bedId,
      sensorDeviceId: null,
      cameraId,
      role: "PRIMARY_CAMERA",
      status: "ACTIVE",
      activeFrom: now,
    });
  }

  function updateCamera(cameraId: string, input: CameraInput): void {
    if (!canManageCameras.value) {
      throw new Error("仅开发者可以管理摄像头");
    }
    const camera = cameras.find((item) => item.id === cameraId);
    if (!camera) throw new Error("摄像头不存在");
    if (
      cameras.some(
        (item) => item.id !== cameraId && item.cameraKey === input.cameraKey.trim(),
      )
    ) {
      throw new Error("摄像头标识已存在");
    }
    if (
      cameras.some(
        (item) => item.id !== cameraId && item.mediaPath === input.mediaPath.trim(),
      )
    ) {
      throw new Error("媒体路径已存在");
    }
    camera.cameraKey = input.cameraKey.trim();
    camera.mediaPath = input.mediaPath.trim();
    camera.mediaServerUrl = normalizeMediaServerUrl(input.mediaServerUrl);
    camera.name = input.name.trim();
    camera.vendor = input.vendor?.trim() || undefined;
    camera.model = input.model?.trim() || undefined;
  }

  function deleteCamera(cameraId: string): void {
    assertCameraMetadataManager();
    const index = cameras.findIndex((item) => item.id === cameraId);
    if (index < 0) throw new Error("摄像头不存在");
    bindings.splice(
      0,
      bindings.length,
      ...bindings.filter((binding) => binding.cameraId !== cameraId),
    );
    cameras.splice(index, 1);
  }

  function addCameraBatch(inputs: CameraInput[]): number {
    if (!canManageCameras.value) throw new Error("仅开发者可以批量导入摄像头");
    if (!inputs.length) throw new Error("没有可导入的摄像头");
    if (inputs.length > 10_000) throw new Error("单次最多导入 10000 台摄像头");

    const cameraKeys = new Set(cameras.map((camera) => camera.cameraKey));
    const mediaPaths = new Set(cameras.map((camera) => camera.mediaPath).filter(Boolean));
    const pending: Camera[] = [];
    for (const input of inputs) {
      const cameraKey = input.cameraKey.trim();
      const mediaPath = input.mediaPath.trim();
      const name = input.name.trim();
      if (!cameraKey || !mediaPath || !name) throw new Error("名称、设备标识和媒体路径不能为空");
      if (cameraKeys.has(cameraKey)) throw new Error(`摄像头标识重复：${cameraKey}`);
      if (mediaPaths.has(mediaPath)) throw new Error(`媒体路径重复：${mediaPath}`);
      cameraKeys.add(cameraKey);
      mediaPaths.add(mediaPath);
      pending.push({
        id: `camera-${cameraSequence++}`,
        cameraKey,
        mediaPath,
        mediaServerUrl: normalizeMediaServerUrl(input.mediaServerUrl),
        name,
        vendor: input.vendor?.trim() || undefined,
        model: input.model?.trim() || undefined,
        status: "OFFLINE",
        playback: null,
      });
    }
    cameras.push(...pending);
    return pending.length;
  }

  function normalizeMediaServerUrl(value: string | undefined): string | undefined {
    const normalized = value?.trim().replace(/\/+$/, "");
    return normalized || undefined;
  }

  function canManageMember(memberId: string): boolean {
    const member = staff.find((item) => item.id === memberId);
    return Boolean(member && canManageStaff.value && canManageRole(activeRole.value, member.role));
  }

  function updateMonitoringPolicy(policy: MonitoringPolicy): void {
    if (!canManagePolicy.value) {
      throw new Error("仅管理员可以修改告警与录像策略");
    }
    monitoringPolicy.value = {
      clipBeforeSeconds: Math.max(1, Number(policy.clipBeforeSeconds) || 30),
      clipAfterSeconds: Math.max(1, Number(policy.clipAfterSeconds) || 60),
      recordingRetentionMinutes: Math.max(1, Number(policy.recordingRetentionMinutes) || 30),
    };
  }

  function updateMqttSettings(settings: MqttSettings): void {
    if (!canViewConnections.value) {
      throw new Error("仅开发者可以修改 MQTT 配置");
    }
    mqttSettings.value = {
      ...settings,
      brokerUrl: settings.brokerUrl.trim(),
      websocketUrl: settings.websocketUrl.trim(),
      clientId: settings.clientId.trim(),
      username: settings.username.trim(),
      password: settings.password,
      alarmTopic: settings.alarmTopic.trim(),
    };
    localStorage.setItem(MQTT_SETTINGS_KEY, JSON.stringify(mqttSettings.value));
  }

  function buildMonitoringBackup(): MonitoringBackup {
    if (activeRole.value !== "DEVELOPER") {
      throw new Error("仅开发者可以导出维护备份");
    }
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      platformName: platformName.value,
      data: JSON.parse(JSON.stringify(fixture.value)) as MonitoringData,
      monitoringPolicy: { ...monitoringPolicy.value },
      mqttSettings: {
        brokerUrl: mqttSettings.value.brokerUrl,
        websocketUrl: mqttSettings.value.websocketUrl,
        clientId: mqttSettings.value.clientId,
        username: mqttSettings.value.username,
        alarmTopic: mqttSettings.value.alarmTopic,
        alarmTitleTemplate: mqttSettings.value.alarmTitleTemplate,
        alarmDetailTemplate: mqttSettings.value.alarmDetailTemplate,
        qos: mqttSettings.value.qos,
      },
      staffTags: [...staffTags.value],
      staffCredentials: exportStaffCredentials(),
    };
  }

  function restoreMonitoringBackup(serialized: string): void {
    if (activeRole.value !== "DEVELOPER") {
      throw new Error("仅开发者可以恢复维护备份");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error("备份文件不是有效的 JSON");
    }
    if (!parsed || typeof parsed !== "object") throw new Error("备份文件格式不正确");
    const backup = parsed as Partial<MonitoringBackup>;
    if (backup.schemaVersion !== DATA_SCHEMA_VERSION || !isMonitoringData(backup.data)) {
      throw new Error("备份版本不兼容或业务数据不完整");
    }

    const nextData = structuredClone(backup.data);
    Object.assign(hospital, nextData.hospital);
    wards.splice(0, wards.length, ...nextData.wards);
    rooms.splice(0, rooms.length, ...nextData.rooms);
    beds.splice(0, beds.length, ...nextData.beds);
    sensors.splice(0, sensors.length, ...nextData.sensors);
    cameras.splice(0, cameras.length, ...nextData.cameras);
    bindings.splice(0, bindings.length, ...nextData.bindings);
    staff.splice(0, staff.length, ...nextData.staff);

    if (typeof backup.platformName === "string" && backup.platformName.trim()) {
      platformName.value = backup.platformName.trim();
      localStorage.setItem(PLATFORM_NAME_KEY, platformName.value);
      document.title = platformName.value;
    }
    if (backup.monitoringPolicy) {
      monitoringPolicy.value = {
        clipBeforeSeconds: Math.max(1, Number(backup.monitoringPolicy.clipBeforeSeconds) || 30),
        clipAfterSeconds: Math.max(1, Number(backup.monitoringPolicy.clipAfterSeconds) || 60),
        recordingRetentionMinutes: Math.max(
          1,
          Number(backup.monitoringPolicy.recordingRetentionMinutes) || 1_440,
        ),
      };
    }
    if (backup.mqttSettings) {
      mqttSettings.value = {
        ...mqttSettings.value,
        ...backup.mqttSettings,
        password: mqttSettings.value.password,
      };
      localStorage.setItem(MQTT_SETTINGS_KEY, JSON.stringify(mqttSettings.value));
    }
    if (Array.isArray(backup.staffTags)) {
      staffTags.value = Array.from(
        new Set(backup.staffTags.filter((tag) => typeof tag === "string" && tag.trim())),
      );
      localStorage.setItem(STAFF_TAGS_KEY, JSON.stringify(staffTags.value));
    }
    restoreStaffCredentials(backup.staffCredentials);

    refreshSequences();
    localStorage.setItem(
      MONITORING_DATA_KEY,
      JSON.stringify({ schemaVersion: DATA_SCHEMA_VERSION, data: fixture.value }),
    );
    localStorage.setItem("monitoring-hospital-name", hospital.name);
  }

  function addBed(input: AddBedInput): string {
    const duplicate = beds.some(
      (bed) => bed.roomId === input.roomId && bed.bedNo.trim() === input.bedNo.trim(),
    );
    if (duplicate) throw new Error("该病房已存在相同床位号");
    const room = rooms.find((item) => item.id === input.roomId);
    if (!room) throw new Error("所属病房不存在");

    const bedId = `bed-${input.wardId.replace("ward-", "")}-${bedSequence++}`;
    const bedNo = input.bedNo.trim();
    const now = new Date().toISOString();
    beds.push({
      id: bedId,
      wardId: input.wardId,
      roomId: input.roomId,
      bedNo,
      patientName: input.patientName?.trim() || undefined,
      status: input.patientName ? "OCCUPIED" : "AVAILABLE",
      lastEditedBy: activeRole.value,
      lastEditedAt: now,
      updatedAt: now,
    });
    const sensorId = `sensor-${bedId}`;
    sensors.push({
      id: sensorId,
      deviceKey: `blanket-${bedId.replace(/^bed-/, "")}`,
      name: `${room.name} ${bedNo} 床毯子传感器`,
      status: "OFFLINE",
      latestMetrics: {},
    });
    bindings.push({
      id: `binding-${bindingSequence++}`,
      bedId,
      sensorDeviceId: sensorId,
      cameraId: null,
      role: "PRIMARY_SENSOR",
      status: "ACTIVE",
      activeFrom: now,
    });
    return bedId;
  }

  function addBlanket(input: BlanketInput): string {
    assertBlanketManager();
    const bed = beds.find((item) => item.id === input.bedId);
    if (!bed) throw new Error("关联床位不存在");
    const name = input.name.trim();
    if (!name) throw new Error("毯子名称不能为空");

    const sequence = blanketSequence++;
    const sensorId = `sensor-blanket-${sequence}`;
    sensors.push({
      id: sensorId,
      deviceKey: `blanket-device-${sequence}`,
      name,
      status: "OFFLINE",
      latestMetrics: {},
    });
    bindBlanketToBed(sensorId, bed.id);
    return sensorId;
  }

  function updateBlanket(sensorId: string, input: BlanketInput): void {
    assertBlanketManager();
    const sensor = sensors.find((item) => item.id === sensorId);
    if (!sensor) throw new Error("毯子不存在");
    const bed = beds.find((item) => item.id === input.bedId);
    if (!bed) throw new Error("关联床位不存在");
    const name = input.name.trim();
    if (!name) throw new Error("毯子名称不能为空");

    sensor.name = name;
    const currentBinding = bindings.find(
      (item) =>
        item.sensorDeviceId === sensorId &&
        item.role === "PRIMARY_SENSOR" &&
        item.status === "ACTIVE",
    );
    if (!currentBinding || currentBinding.bedId !== bed.id) {
      bindBlanketToBed(sensorId, bed.id);
    }
  }

  function deleteBlanket(sensorId: string): void {
    assertBlanketManager();
    const index = sensors.findIndex((sensor) => sensor.id === sensorId);
    if (index < 0) throw new Error("毯子不存在");
    bindings.splice(
      0,
      bindings.length,
      ...bindings.filter((binding) => binding.sensorDeviceId !== sensorId),
    );
    sensors.splice(index, 1);
  }

  function assertBlanketManager(): void {
    if (!canManageBindings.value) {
      throw new Error("仅管理员或开发者可以管理毯子");
    }
  }

  function bindBlanketToBed(sensorId: string, bedId: string): void {
    const now = new Date().toISOString();
    for (const binding of bindings) {
      if (binding.status !== "ACTIVE" || binding.role !== "PRIMARY_SENSOR") continue;
      if (binding.bedId === bedId || binding.sensorDeviceId === sensorId) {
        binding.status = "INACTIVE";
        binding.activeTo = now;
      }
    }
    bindings.push({
      id: `binding-${bindingSequence++}`,
      bedId,
      sensorDeviceId: sensorId,
      cameraId: null,
      role: "PRIMARY_SENSOR",
      status: "ACTIVE",
      activeFrom: now,
    });
  }

  function updatePatient(bedId: string, input: PatientUpdateInput): void {
    const bed = beds.find((item) => item.id === bedId);
    if (!bed) throw new Error("床位不存在");
    const locationChanged =
      (input.wardId !== undefined && input.wardId !== bed.wardId) ||
      (input.roomId !== undefined && input.roomId !== bed.roomId) ||
      (input.bedNo !== undefined && input.bedNo.trim() !== bed.bedNo);
    if (locationChanged && activeRole.value !== "ADMIN") {
      throw new Error("仅管理员可以修改病区、病房和床位号");
    }

    bed.patientName = input.patientName.trim() || undefined;
    bed.patientNo = input.patientNo.trim() || undefined;
    bed.patientStatus = input.patientStatus;
    bed.status = input.bedStatus;
    if (input.wardId) bed.wardId = input.wardId;
    if (input.roomId) bed.roomId = input.roomId;
    if (input.bedNo?.trim()) bed.bedNo = input.bedNo.trim();
    bed.lastEditedBy = activeRole.value;
    bed.lastEditedAt = new Date().toISOString();
    bed.updatedAt = new Date().toISOString();
  }

  function deleteBed(bedId: string): void {
    if (activeRole.value !== "ADMIN" && activeRole.value !== "DEVELOPER") {
      throw new Error("仅管理员或开发者可以删除床位");
    }
    const index = beds.findIndex((bed) => bed.id === bedId);
    if (index < 0) throw new Error("床位不存在");
    if (alarms.value.some((alarm) => alarm.bedId === bedId && alarm.status === "OPEN")) {
      throw new Error("该床位还有未处理告警，请先标记解决");
    }

    const sensorIds = new Set(
      bindings
        .filter((binding) => binding.bedId === bedId)
        .map((binding) => binding.sensorDeviceId)
        .filter((sensorId): sensorId is string => Boolean(sensorId)),
    );
    beds.splice(index, 1);
    sensors.splice(
      0,
      sensors.length,
      ...sensors.filter((sensor) => !sensorIds.has(sensor.id)),
    );
    bindings.splice(
      0,
      bindings.length,
      ...bindings.filter(
        (binding) => binding.bedId !== bedId && !sensorIds.has(binding.sensorDeviceId ?? ""),
      ),
    );
    alarms.value = alarms.value.filter((alarm) => alarm.bedId !== bedId);
  }

  function ingestAlarm(alarm: AlarmEnvelope): void {
    const bed = beds.find((item) => item.id === alarm.bedId);
    if (!bed) throw new Error("告警必须关联有效床位");
    const normalizedAlarm = {
      ...alarm,
      wardId: alarm.wardId || bed.wardId,
      roomId: alarm.roomId || bed.roomId,
    };
    const existing = alarms.value.findIndex((item) => item.alarmId === alarm.alarmId);
    const shouldNotify = existing === -1;
    if (existing === -1) {
      alarms.value.unshift(normalizedAlarm);
    } else {
      alarms.value[existing] = normalizedAlarm;
    }
    const lastNotification = alarmNotificationTimes.get(alarm.bedId) ?? 0;
    const canNotify = Date.now() - lastNotification >= 1_500;
    if (shouldNotify && canNotify && typeof window !== "undefined") {
      alarmNotificationTimes.set(alarm.bedId, Date.now());
      ElNotification({
        title: `${bed.bedNo} 床告警`,
        message: alarm.title,
        type: alarm.level === "INFO" ? "info" : "error",
        duration: 6_000,
        position: "top-right",
      });
    }
  }

  function resolveAlarm(alarmId: string): void {
    const alarm = alarms.value.find((item) => item.alarmId === alarmId);
    if (!alarm) return;
    alarm.status = "RESOLVED";
    alarm.resolvedAt = new Date().toISOString();
  }

  function removeAlarm(alarmId: string): void {
    const index = alarms.value.findIndex((item) => item.alarmId === alarmId);
    if (index >= 0) alarms.value.splice(index, 1);
  }

  function replaceAlarms(nextAlarms: AlarmEnvelope[]): void {
    const unique = new Map<string, AlarmEnvelope>();
    for (const alarm of nextAlarms) {
      if (!alarm || typeof alarm.alarmId !== "string" || !alarm.alarmId) continue;
      if (!beds.some((bed) => bed.id === alarm.bedId)) continue;
      unique.set(alarm.alarmId, structuredClone(alarm));
    }
    alarms.value = [...unique.values()];
  }

  function setSensorDevices(nextSensors: SensorDevice[]): void {
    sensors.splice(0, sensors.length, ...nextSensors);
  }

  function syncSensorSnapshot(bedId: string, snapshot: SensorSnapshot): void {
    const summary = getBedMonitorSummary(bedId, fixture.value);
    const sensor = summary?.sensor;
    if (!sensor) return;
    if (
      snapshot.status === "ONLINE" ||
      snapshot.status === "STALE" ||
      snapshot.status === "OFFLINE" ||
      snapshot.status === "ALARM"
    ) {
      sensor.status = snapshot.status;
    }
    if (typeof snapshot.data === "string") {
      sensor.latestData = normalizeHexData(snapshot.data);
    }
    if (snapshot.observedAt) sensor.lastSeenAt = snapshot.observedAt;
  }

  function setCameras(nextCameras: Camera[]): void {
    cameras.splice(0, cameras.length, ...nextCameras);
  }

  function syncCameraStatus(cameraId: string, status: Camera["status"]): void {
    const camera = cameras.find((item) => item.id === cameraId);
    if (camera) camera.status = status;
  }

  return {
    hospital,
    platformName,
    wards,
    rooms,
    beds,
    sensors,
    cameras,
    bindings,
    staff,
    alarms,
    staffTags,
    monitoringPolicy,
    mqttSettings,
    currentWardIds,
    activeRole,
    activeUsername,
    activeModulePermissions,
    currentWards,
    visibleBeds,
    bedSummaries,
    openAlarmCount,
    unboundBedCount,
    canManageBindings,
    canManageOrganization,
    canManageStaff,
    canManageCameras,
    canManagePolicy,
    canViewConnections,
    canViewDeveloperConsole,
    getBedBindings,
    updateBinding,
    setCurrentWardIds,
    setActiveRole,
    updateHospitalName,
    updatePlatformName,
    canAccessModule,
    addWard,
    updateWard,
    deleteWard,
    addRoom,
    updateRoom,
    deleteRoom,
    addStaff,
    addStaffTag,
    deleteStaffTag,
    updateStaff,
    deleteStaff,
    canManageMember,
    addCamera,
    addCameraBatch,
    addManagedCamera,
    updateManagedCamera,
    updateCamera,
    deleteCamera,
    updateMonitoringPolicy,
    updateMqttSettings,
    buildMonitoringBackup,
    restoreMonitoringBackup,
    addBed,
    addBlanket,
    updateBlanket,
    deleteBlanket,
    updatePatient,
    deleteBed,
    ingestAlarm,
    resolveAlarm,
    removeAlarm,
    replaceAlarms,
    setSensorDevices,
    syncSensorSnapshot,
    setCameras,
    syncCameraStatus,
  };
});
