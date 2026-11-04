import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMonitoringStore } from "./store";

describe("monitoring store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("only exposes beds from assigned wards", () => {
    const store = useMonitoringStore();

    expect(store.visibleBeds.length).toBeGreaterThan(0);
    expect(store.visibleBeds.every((bed) => store.currentWardIds.includes(bed.wardId))).toBe(true);
  });

  it("can replace a bed camera binding without changing another bed", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");
    const otherBindingsBefore = store.getBedBindings("bed-a-02");

    store.updateBinding({
      bedId: "bed-a-01",
      sensorDeviceId: "sensor-bed-a-01",
      cameraId: "camera-01",
    });

    expect(
      store
        .getBedBindings("bed-a-01")
        .map((item) => item.cameraId)
        .filter(Boolean),
    ).toEqual(["camera-01"]);
    expect(store.getBedBindings("bed-a-02")).toEqual(otherBindingsBefore);
  });

  it("lets a nurse add a bed and update patient information and status", () => {
    const store = useMonitoringStore();
    store.setActiveRole("NURSE");

    store.addBed({
      wardId: "ward-a",
      roomId: "room-a-303",
      bedNo: "03",
      patientName: "新入院患者",
    });
    const addedBed = store.beds.find((bed) => bed.bedNo === "03" && bed.roomId === "room-a-303")!;
    store.updatePatient(addedBed.id, {
      patientName: "王小明",
      patientNo: "ZY20261104003",
      patientStatus: "OBSERVATION",
      bedStatus: "OCCUPIED",
    });

    expect(store.beds.find((bed) => bed.id === addedBed.id)?.patientName).toBe("王小明");
    expect(store.beds.find((bed) => bed.id === addedBed.id)?.patientStatus).toBe("OBSERVATION");
    expect(store.canManageBindings).toBe(false);
  });

  it("prevents a nurse from changing device bindings", () => {
    const store = useMonitoringStore();
    store.setActiveRole("NURSE");

    expect(() =>
      store.updateBinding({
        bedId: "bed-a-01",
        sensorDeviceId: "sensor-bed-a-01",
        cameraId: "camera-01",
      }),
    ).toThrow("仅管理员或开发者可以修改设备绑定");
  });

  it("turns a resolved warning into a resolved alarm state", () => {
    vi.useFakeTimers();
    const store = useMonitoringStore();
    store.ingestAlarm({
      alarmId: "alarm-01",
      code: "SENSOR_STATE_CHANGED",
      level: "WARNING",
      status: "OPEN",
      title: "传感器状态异常",
      detail: "设备上报状态变化",
      sensorKey: "blanket-001",
      cameraKey: "camera-01",
      bedId: "bed-a-01",
      occurredAt: "2026-11-04T17:20:00+08:00",
    });
    store.resolveAlarm("alarm-01");

    expect(store.alarms[0]?.status).toBe("RESOLVED");
    expect(store.alarms[0]?.resolvedAt).toBeTruthy();
    vi.advanceTimersByTime(3_100);
    expect(store.alarms).toHaveLength(0);
    vi.useRealTimers();
  });

  it("lets an administrator overwrite patient content edited by a nurse", () => {
    const store = useMonitoringStore();
    store.setActiveRole("NURSE");
    store.updatePatient("bed-a-01", {
      patientName: "护士修改",
      patientNo: "NURSE-001",
      patientStatus: "OBSERVATION",
      bedStatus: "OCCUPIED",
    });

    store.setActiveRole("ADMIN");
    store.updatePatient("bed-a-01", {
      patientName: "管理员修改",
      patientNo: "ADMIN-001",
      patientStatus: "STABLE",
      bedStatus: "OCCUPIED",
      wardId: "ward-b",
      roomId: "room-b-203",
      bedNo: "09",
    });

    const bed = store.beds.find((item) => item.id === "bed-a-01");
    expect(bed?.patientName).toBe("管理员修改");
    expect(bed?.patientNo).toBe("ADMIN-001");
    expect(bed?.wardId).toBe("ward-b");
    expect(bed?.roomId).toBe("room-b-203");
    expect(bed?.bedNo).toBe("09");
    expect(bed?.lastEditedBy).toBe("ADMIN");
  });

  it("lets an administrator manage wards and rooms", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");

    const wardId = store.addWard({ code: "WARD-C", name: "C 病区 · 内科" });
    const roomId = store.addRoom({
      wardId,
      roomNo: "501",
      name: "501 病房",
    });
    store.updateWard(wardId, { code: "WARD-C", name: "C 病区 · 呼吸内科" });
    store.updateRoom(roomId, { roomNo: "502", name: "502 病房" });

    expect(store.wards.find((ward) => ward.id === wardId)?.name).toBe("C 病区 · 呼吸内科");
    expect(store.rooms.find((room) => room.id === roomId)?.roomNo).toBe("502");
  });

  it("prevents a nurse from managing wards and rooms", () => {
    const store = useMonitoringStore();
    store.setActiveRole("NURSE");

    expect(() => store.addWard({ code: "WARD-C", name: "C 病区" })).toThrow(
      "仅管理员可以管理病区和病房",
    );
  });

  it("lets an administrator manage staff roles and ward permissions", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");

    const staffId = store.addStaff({
      username: "nurse-li",
      displayName: "李护士",
      role: "NURSE",
      wardIds: ["ward-a"],
      status: "ACTIVE",
      initialPassword: "Nurse@123456",
    });
    store.updateStaff(staffId, {
      username: "nurse-li",
      displayName: "李护士",
      role: "HEAD_NURSE",
      wardIds: ["ward-a", "ward-b"],
      status: "ACTIVE",
      initialPassword: "Reset@123456",
    });

    expect(store.staff.find((item) => item.id === staffId)?.role).toBe("HEAD_NURSE");
    expect(store.staff.find((item) => item.id === staffId)?.wardIds).toEqual(["ward-a", "ward-b"]);
    expect(store.staff.find((item) => item.id === staffId)?.passwordUpdatedAt).toBeTruthy();
  });

  it("prevents a nurse from managing staff permissions", () => {
    const store = useMonitoringStore();
    store.setActiveRole("NURSE");

    expect(() =>
      store.addStaff({
        username: "nurse-li",
        displayName: "李护士",
        role: "NURSE",
        wardIds: ["ward-a"],
        status: "ACTIVE",
        initialPassword: "Nurse@123456",
      }),
    ).toThrow("仅管理员可以管理人员权限");
  });

  it("lets an administrator add any number of cameras", () => {
    const store = useMonitoringStore();
    store.setActiveRole("DEVELOPER");
    const before = store.cameras.length;

    store.addCamera({
      cameraKey: "camera-02",
      mediaPath: "camera-02",
      name: "201 病房摄像头",
    });
    store.addCamera({
      cameraKey: "camera-03",
      mediaPath: "camera-03",
      name: "202 病房摄像头",
    });

    expect(store.cameras.length).toBe(before + 2);
  });

  it("lets only an administrator change alert and recording policy", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");
    store.updateMonitoringPolicy({
      clipBeforeSeconds: 45,
      clipAfterSeconds: 90,
      recordingRetentionMinutes: 60,
    });

    expect(store.monitoringPolicy.recordingRetentionMinutes).toBe(60);

    store.setActiveRole("NURSE");
    expect(() =>
      store.updateMonitoringPolicy({
        clipBeforeSeconds: 10,
        clipAfterSeconds: 20,
        recordingRetentionMinutes: 10,
      }),
    ).toThrow("仅管理员可以修改告警与录像策略");
  });

  it("shows and updates MQTT account settings only for developers", () => {
    const store = useMonitoringStore();
    store.setActiveRole("DEVELOPER");
    store.updateMqttSettings({
      ...store.mqttSettings,
      brokerUrl: "mqtt://192.168.86.128:1883",
      websocketUrl: "ws://192.168.86.128:8083/mqtt",
      username: "blanket-service",
      password: "Mqtt@123456",
      qos: 1,
    });

    expect(store.mqttSettings.username).toBe("blanket-service");
    expect(store.mqttSettings.qos).toBe(1);

    store.setActiveRole("ADMIN");
    expect(() =>
      store.updateMqttSettings({
        ...store.mqttSettings,
        qos: 2,
      }),
    ).toThrow("仅开发者可以修改 MQTT 配置");
  });

  it("gives the developer technical visibility beyond hospital administrators", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");
    expect(store.canViewConnections).toBe(false);
    expect(store.canViewDeveloperConsole).toBe(false);

    store.setActiveRole("DEVELOPER");
    expect(store.canManageStaff).toBe(true);
    expect(store.canManageBindings).toBe(true);
    expect(store.canViewConnections).toBe(true);
    expect(store.canViewDeveloperConsole).toBe(true);
  });

  it("prevents hospital administrators from managing developer accounts", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");

    expect(() =>
      store.updateStaff("staff-developer", {
        username: "developer",
        displayName: "被管理员修改",
        role: "DEVELOPER",
        wardIds: ["ward-a"],
        status: "DISABLED",
      }),
    ).toThrow("医院管理员不能管理系统开发者账号");

    expect(() =>
      store.addStaff({
        username: "developer-2",
        displayName: "第二开发者",
        role: "DEVELOPER",
        wardIds: ["ward-a"],
        status: "ACTIVE",
        initialPassword: "Developer@123",
      }),
    ).toThrow("医院管理员不能创建系统开发者账号");
  });

  it("separates module permissions by role", () => {
    const store = useMonitoringStore();
    store.setActiveRole("NURSE", "nurse");
    expect(store.canAccessModule("beds")).toBe(true);
    expect(store.canAccessModule("mqtt")).toBe(false);

    store.setActiveRole("DEVELOPER", "developer");
    expect(store.canAccessModule("mqtt")).toBe(true);
    expect(store.canAccessModule("video")).toBe(true);
  });

  it("prevents hospital administrators from changing module grants", () => {
    const store = useMonitoringStore();
    const member = store.staff.find((item) => item.username === "nurse")!;
    store.setActiveRole("ADMIN");

    expect(() =>
      store.updateStaff(member.id, {
        username: member.username,
        displayName: member.displayName,
        role: member.role,
        wardIds: member.wardIds,
        status: member.status,
        modulePermissions: ["overview", "beds"],
      }),
    ).toThrow("仅开发者可以修改人员模块权限");
  });
});
