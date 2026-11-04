import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { createMonitoringFixture } from "./mock-data";
import type { AlarmEnvelope } from "./recording";
import { getBedMonitorSummary } from "./selectors";
import type {
  AddBedInput,
  BindingInput,
  Camera,
  DeviceBinding,
  MonitoringData,
  MonitoringRole,
  PatientUpdateInput,
  SensorDevice,
} from "./types";

export const useMonitoringStore = defineStore("monitoring", () => {
  const fixture = ref<MonitoringData>(createMonitoringFixture());
  const currentWardIds = ref(["ward-a", "ward-b"]);
  const storedRole = sessionStorage.getItem("monitoring-role");
  const activeRole = ref<MonitoringRole>(
    storedRole === "NURSE" || storedRole === "ADMIN" ? storedRole : "ADMIN",
  );
  const alarms = ref<AlarmEnvelope[]>([]);
  let bindingSequence = 100;
  let bedSequence = 100;

  const { hospital, wards, rooms, beds, sensors, cameras, bindings } = fixture.value;

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
  const canManageBindings = computed(() => activeRole.value === "ADMIN");

  function getBedBindings(bedId: string): DeviceBinding[] {
    return bindings.filter((binding) => binding.bedId === bedId && binding.status === "ACTIVE");
  }

  function updateBinding(input: BindingInput): void {
    if (!canManageBindings.value) {
      throw new Error("仅管理员可以修改设备绑定");
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
    alarms,
    currentWardIds,
    activeRole,
    currentWards,
    visibleBeds,
    bedSummaries,
    canManageBindings,
    getBedBindings,
    updateBinding,
    setCurrentWardIds,
    setActiveRole,
    addBed,
    updatePatient,
    ingestAlarm,
    resolveAlarm,
    setSensorDevices,
    setCameras,
  };
});
