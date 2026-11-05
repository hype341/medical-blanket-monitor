import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { ElNotification } from "element-plus";
import { createMonitoringFixture } from "./mock-data";
import { defaultModulesForRole } from "./permissions";
import type { AlarmEnvelope } from "./recording";
import { getBedMonitorSummary } from "./selectors";
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
  StaffInput,
  UpdateRoomInput,
  UpdateWardInput,
} from "./types";

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
const DEFAULT_PLATFORM_NAME = "医用智能毯安全监护平台";
const DEFAULT_STAFF_TAGS = ["责任护士", "夜班", "实习"];
const DEFAULT_MQTT_SETTINGS: MqttSettings = {
  brokerUrl: "mqtt://10.208.236.217:1883",
  websocketUrl: "ws://10.208.236.217:8083/mqtt",
  clientId: "medical-blanket-platform",
  username: "blanket-service",
  password: "demo-mqtt-secret",
  alarmTopic: "medical-blanket/v1/+/+/+/+/alarm",
  alarmTitleTemplate: "{{deviceName}} 状态异常",
  alarmDetailTemplate: "{{bedName}} 在 {{occurredAt}} 上报 {{alarmCode}}",
  qos: 1,
};

function loadMqttSettings(): MqttSettings {
  try {
    const value = JSON.parse(localStorage.getItem(MQTT_SETTINGS_KEY) ?? "null") as unknown;
    return value && typeof value === "object"
      ? { ...DEFAULT_MQTT_SETTINGS, ...(value as Partial<MqttSettings>) }
      : { ...DEFAULT_MQTT_SETTINGS };
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
  const fixture = ref<MonitoringData>(createMonitoringFixture());
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
  watch(alarms, (value) => sessionStorage.setItem("monitoring-alarms", JSON.stringify(value)), {
    deep: true,
  });
  const monitoringPolicy = ref<MonitoringPolicy>({
    clipBeforeSeconds: 30,
    clipAfterSeconds: 60,
    recordingRetentionMinutes: 1_440,
  });
  const mqttSettings = ref<MqttSettings>(loadMqttSettings());
  let bindingSequence = 100;
  let bedSequence = 100;
  let blanketSequence = 100;
  let wardSequence = 100;
  let roomSequence = 100;
  let staffSequence = 100;
  let cameraSequence = 100;

  const { hospital, wards, rooms, beds, sensors, cameras, bindings, staff } = fixture.value;
  const activeUsername = ref(sessionStorage.getItem("monitoring-username") ?? "");
  const storedModules = sessionStorage.getItem("monitoring-modules");
  const activeModulePermissions = ref<PermissionModule[]>(
    storedModules
      ? (JSON.parse(storedModules) as PermissionModule[])
      : defaultModulesForRole(activeRole.value),
  );

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
    visibleBeds.value
      .map((bed) => getBedMonitorSummary(bed.id, fixture.value))
      .filter((summary) => summary !== null),
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
    currentWardIds.value = wardIds;
    sessionStorage.setItem("monitoring-wards", JSON.stringify(wardIds));
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

  function addStaff(input: StaffInput): string {
    if (!canManageStaff.value) {
      throw new Error("仅管理员可以管理人员权限");
    }
    if (input.role === "DEVELOPER" && activeRole.value !== "DEVELOPER") {
      throw new Error("医院管理员不能创建系统开发者账号");
    }
    const requestedModules = input.modulePermissions ?? defaultModulesForRole(input.role);
    if (
      activeRole.value !== "DEVELOPER" &&
      !sameModules(requestedModules, defaultModulesForRole(input.role))
    ) {
      throw new Error("仅开发者可以修改人员模块权限");
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
    if (
      activeRole.value !== "DEVELOPER" &&
      (member.role === "DEVELOPER" || input.role === "DEVELOPER")
    ) {
      throw new Error("医院管理员不能管理系统开发者账号");
    }
    const requestedModules = input.modulePermissions ?? [
      ...(member.modulePermissions ?? defaultModulesForRole(member.role)),
    ];
    if (
      activeRole.value !== "DEVELOPER" &&
      !sameModules(requestedModules, member.modulePermissions ?? defaultModulesForRole(member.role))
    ) {
      throw new Error("仅开发者可以修改人员模块权限");
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

  function addStaffTag(name: string): void {
    if (!canManageStaff.value) throw new Error("仅管理员或开发者可以管理角色标签");
    const normalized = name.trim().replace(/\s+/g, " ");
    if (!normalized) throw new Error("角色标签不能为空");
    if (!staffTags.value.includes(normalized)) {
      staffTags.value.push(normalized);
      localStorage.setItem(STAFF_TAGS_KEY, JSON.stringify(staffTags.value));
    }
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
    const cameraId = `camera-${cameraSequence++}`;
    cameras.push({
      id: cameraId,
      cameraKey: input.cameraKey.trim(),
      mediaPath: input.mediaPath.trim(),
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
    camera.cameraKey = input.cameraKey.trim();
    camera.mediaPath = input.mediaPath.trim();
    camera.name = input.name.trim();
    camera.vendor = input.vendor?.trim() || undefined;
    camera.model = input.model?.trim() || undefined;
  }

  function sameModules(left: PermissionModule[], right: PermissionModule[]): boolean {
    return left.length === right.length && left.every((module) => right.includes(module));
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

  function ingestAlarm(alarm: AlarmEnvelope): void {
    const bed = beds.find((item) => item.id === alarm.bedId);
    if (!bed) throw new Error("告警必须关联有效床位");
    const normalizedAlarm = {
      ...alarm,
      wardId: alarm.wardId || bed.wardId,
      roomId: alarm.roomId || bed.roomId,
    };
    const existing = alarms.value.findIndex((item) => item.alarmId === alarm.alarmId);
    if (existing === -1) {
      alarms.value.unshift(normalizedAlarm);
    } else {
      alarms.value[existing] = normalizedAlarm;
    }
    if (typeof window !== "undefined") {
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

  function setSensorDevices(nextSensors: SensorDevice[]): void {
    sensors.splice(0, sensors.length, ...nextSensors);
  }

  function setCameras(nextCameras: Camera[]): void {
    cameras.splice(0, cameras.length, ...nextCameras);
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
    addRoom,
    updateRoom,
    addStaff,
    addStaffTag,
    updateStaff,
    addCamera,
    addManagedCamera,
    updateManagedCamera,
    updateCamera,
    updateMonitoringPolicy,
    updateMqttSettings,
    addBed,
    addBlanket,
    updateBlanket,
    updatePatient,
    ingestAlarm,
    resolveAlarm,
    removeAlarm,
    setSensorDevices,
    setCameras,
  };
});
