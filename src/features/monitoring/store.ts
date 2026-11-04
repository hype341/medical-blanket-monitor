import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { createMonitoringFixture } from "./mock-data";
import type { AlarmEnvelope } from "./recording";
import { getBedMonitorSummary } from "./selectors";
import type {
  AddBedInput,
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
  PatientUpdateInput,
  SensorDevice,
  StaffInput,
  UpdateRoomInput,
  UpdateWardInput,
} from "./types";

export const useMonitoringStore = defineStore("monitoring", () => {
  const fixture = ref<MonitoringData>(createMonitoringFixture());
  const currentWardIds = ref(["ward-a", "ward-b"]);
  const storedRole = sessionStorage.getItem("monitoring-role");
  const activeRole = ref<MonitoringRole>(
    storedRole === "NURSE" ||
      storedRole === "HEAD_NURSE" ||
      storedRole === "ADMIN" ||
      storedRole === "DEVELOPER"
      ? storedRole
      : "ADMIN",
  );
  const alarms = ref<AlarmEnvelope[]>([]);
  const monitoringPolicy = ref<MonitoringPolicy>({
    clipBeforeSeconds: 30,
    clipAfterSeconds: 60,
    recordingRetentionMinutes: 30,
  });
  const mqttSettings = ref<MqttSettings>({
    brokerUrl: "mqtt://192.168.86.128:1883",
    websocketUrl: "ws://192.168.86.128:8083/mqtt",
    clientId: "medical-blanket-platform",
    username: "blanket-service",
    password: "demo-mqtt-secret",
    telemetryTopic: "medical-blanket/v1/+/+/+/sensor/+/telemetry",
    alarmTopic: "medical-blanket/v1/+/+/+/alarm/+",
    alarmTitleTemplate: "{{deviceName}} 状态异常",
    alarmDetailTemplate: "{{bedName}} 在 {{occurredAt}} 上报 {{alarmCode}}",
    qos: 1,
  });
  let bindingSequence = 100;
  let bedSequence = 100;
  let wardSequence = 100;
  let roomSequence = 100;
  let staffSequence = 100;
  let cameraSequence = 100;

  const { hospital, wards, rooms, beds, sensors, cameras, bindings, staff } = fixture.value;

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
  }

  function setActiveRole(role: MonitoringRole): void {
    activeRole.value = role;
    sessionStorage.setItem("monitoring-role", role);
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
    if (staff.some((item) => item.username === input.username.trim())) {
      throw new Error("登录账号已存在");
    }
    if (!input.initialPassword || input.initialPassword.length < 6) {
      throw new Error("初始密码不能少于 6 位");
    }
    const staffId = `staff-${staffSequence++}`;
    staff.push({
      id: staffId,
      username: input.username.trim(),
      displayName: input.displayName.trim(),
      role: input.role,
      wardIds: [...input.wardIds],
      status: input.status,
      passwordUpdatedAt: new Date().toISOString(),
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
    member.username = input.username.trim();
    member.displayName = input.displayName.trim();
    member.role = input.role;
    member.wardIds = [...input.wardIds];
    member.status = input.status;
    if (input.initialPassword) {
      if (input.initialPassword.length < 6) {
        throw new Error("新密码不能少于 6 位");
      }
      member.passwordUpdatedAt = new Date().toISOString();
    }
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
      telemetryTopic: settings.telemetryTopic.trim(),
      alarmTopic: settings.alarmTopic.trim(),
    };
  }

  function addBed(input: AddBedInput): string {
    const duplicate = beds.some(
      (bed) => bed.roomId === input.roomId && bed.bedNo.trim() === input.bedNo.trim(),
    );
    if (duplicate) throw new Error("该病房已存在相同床位号");

    const bedId = `bed-${input.wardId.replace("ward-", "")}-${bedSequence++}`;
    beds.push({
      id: bedId,
      wardId: input.wardId,
      roomId: input.roomId,
      bedNo: input.bedNo.trim(),
      patientName: input.patientName?.trim() || undefined,
      status: input.patientName ? "OCCUPIED" : "AVAILABLE",
      lastEditedBy: activeRole.value,
      lastEditedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return bedId;
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
    const existing = alarms.value.findIndex((item) => item.alarmId === alarm.alarmId);
    if (existing === -1) {
      alarms.value.unshift(alarm);
    } else {
      alarms.value[existing] = alarm;
    }
  }

  function resolveAlarm(alarmId: string): void {
    const alarm = alarms.value.find((item) => item.alarmId === alarmId);
    if (!alarm) return;
    alarm.status = "RESOLVED";
    alarm.resolvedAt = new Date().toISOString();
    setTimeout(() => {
      const index = alarms.value.findIndex((item) => item.alarmId === alarmId);
      if (index >= 0) alarms.value.splice(index, 1);
    }, 3000);
  }

  function setSensorDevices(nextSensors: SensorDevice[]): void {
    sensors.splice(0, sensors.length, ...nextSensors);
  }

  function setCameras(nextCameras: Camera[]): void {
    cameras.splice(0, cameras.length, ...nextCameras);
  }

  return {
    hospital,
    wards,
    rooms,
    beds,
    sensors,
    cameras,
    bindings,
    staff,
    alarms,
    monitoringPolicy,
    mqttSettings,
    currentWardIds,
    activeRole,
    currentWards,
    visibleBeds,
    bedSummaries,
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
    addWard,
    updateWard,
    addRoom,
    updateRoom,
    addStaff,
    updateStaff,
    addCamera,
    updateCamera,
    updateMonitoringPolicy,
    updateMqttSettings,
    addBed,
    updatePatient,
    ingestAlarm,
    resolveAlarm,
    setSensorDevices,
    setCameras,
  };
});
