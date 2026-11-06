import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMonitoringStore } from "./store";

describe("monitoring store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.removeItem("monitoring-alarms");
    sessionStorage.removeItem("monitoring-role");
    sessionStorage.removeItem("monitoring-modules");
    localStorage.removeItem("monitoring-mqtt-settings");
    localStorage.removeItem("monitoring-platform-name");
    localStorage.removeItem("monitoring-staff-tags");
    localStorage.removeItem("monitoring-module-schema");
    localStorage.removeItem("monitoring-business-data");
    localStorage.removeItem("monitoring-policy");
  });

  it("only exposes beds from assigned wards", () => {
    const store = useMonitoringStore();

    expect(store.visibleBeds.length).toBeGreaterThan(0);
    expect(store.visibleBeds.every((bed) => store.currentWardIds.includes(bed.wardId))).toBe(true);
  });

  it("gives administrators every ward and automatically includes newly added wards", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");
    store.setCurrentWardIds(["ward-a"]);
    expect(store.currentWardIds).toEqual(store.wards.map((ward) => ward.id));

    const wardId = store.addWard({ code: "WARD-C", name: "C 病区 · 内科" });
    expect(store.currentWardIds).toContain(wardId);
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

  it("automatically creates a bound blanket sensor and MQTT topics with a new bed", () => {
    const store = useMonitoringStore();
    store.setActiveRole("NURSE");

    const bedId = store.addBed({
      wardId: "ward-a",
      roomId: "room-a-303",
      bedNo: "03",
      patientName: "新入院患者",
    });
    const summary = store.bedSummaries.find((item) => item.bed.id === bedId);

    expect(summary?.sensor).toMatchObject({
      id: "sensor-bed-a-100",
      deviceKey: "blanket-a-100",
      name: "303 病房 03 床毯子传感器",
      status: "OFFLINE",
    });
    expect(store.sensors.filter((sensor) => sensor.id === "sensor-bed-a-100")).toHaveLength(1);
    expect(summary?.dataTopic).toBe(
      "medical-blanket/v1/H001/WARD-A/303-03/sensor/blanket-a-100/data",
    );
    expect(summary?.alarmTopic).toBe("medical-blanket/v1/H001/WARD-A/303-03/alarm");
    expect(store.getBedBindings(bedId)).toEqual([
      expect.objectContaining({
        sensorDeviceId: "sensor-bed-a-100",
        cameraId: null,
        role: "PRIMARY_SENSOR",
        status: "ACTIVE",
      }),
    ]);
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
      wardId: "ward-a",
      roomId: "room-a-301",
      bedId: "bed-a-01",
      occurredAt: "2026-11-04T17:20:00+08:00",
    });
    store.resolveAlarm("alarm-01");

    expect(store.alarms[0]?.status).toBe("RESOLVED");
    expect(store.alarms[0]?.resolvedAt).toBeTruthy();
    vi.advanceTimersByTime(3_100);
    expect(store.alarms).toHaveLength(1);
    store.removeAlarm("alarm-01");
    expect(store.alarms).toHaveLength(0);
    vi.useRealTimers();
  });

  it("tracks open alarms and incompletely bound beds for the sidebar", () => {
    const store = useMonitoringStore();

    expect(store.openAlarmCount).toBe(0);
    expect(store.unboundBedCount).toBeGreaterThan(0);

    store.ingestAlarm({
      alarmId: "alarm-sidebar-01",
      code: "BLANKET_ALERT",
      level: "WARNING",
      status: "OPEN",
      title: "毯子状态异常",
      detail: "设备上报状态变化",
      sensorKey: "blanket-001",
      cameraKey: "camera-01",
      wardId: "ward-a",
      roomId: "room-a-301",
      bedId: "bed-a-01",
      occurredAt: "2026-11-05T20:00:00+08:00",
    });

    expect(store.openAlarmCount).toBe(1);
    store.resolveAlarm("alarm-sidebar-01");
    expect(store.openAlarmCount).toBe(0);
  });

  it("applies the latest Spring sensor snapshot to the bound device", () => {
    const store = useMonitoringStore();

    store.syncSensorSnapshot("bed-a-01", {
      status: "ONLINE",
      data: "ff,aa",
      observedAt: "2026-11-05T22:00:00+08:00",
    });

    const sensor = store.bedSummaries.find((item) => item.bed.id === "bed-a-01")?.sensor;
    expect(sensor).toMatchObject({
      status: "ONLINE",
      latestData: "ff,aa",
      lastSeenAt: "2026-11-05T22:00:00+08:00",
    });
  });

  it("migrates manager sessions so new blanket and camera modules stay visible", () => {
    sessionStorage.setItem("monitoring-role", "ADMIN");
    sessionStorage.setItem(
      "monitoring-modules",
      JSON.stringify(["overview", "beds", "bindings", "organization", "staff", "policy"]),
    );

    const store = useMonitoringStore();

    expect(store.activeModulePermissions).toEqual(
      expect.arrayContaining(["blankets", "video"]),
    );
  });

  it("creates and renames a blanket while keeping its MQTT device name in sync", () => {
    const store = useMonitoringStore();
    store.setActiveRole("DEVELOPER");

    const sensorId = store.addBlanket({
      name: "01 床保暖毯",
      bedId: "bed-a-01",
    });

    expect(store.bedSummaries.find((item) => item.bed.id === "bed-a-01")?.sensor?.name).toBe(
      "01 床保暖毯",
    );

    store.updateBlanket(sensorId, {
      name: "01 床智能毯",
      bedId: "bed-a-02",
    });

    expect(store.bedSummaries.find((item) => item.bed.id === "bed-a-01")?.sensor).toBeNull();
    expect(store.bedSummaries.find((item) => item.bed.id === "bed-a-02")?.sensor).toMatchObject({
      id: sensorId,
      name: "01 床智能毯",
    });
  });

  it("prevents nurses from creating or renaming blankets", () => {
    const store = useMonitoringStore();
    store.setActiveRole("NURSE");

    expect(() =>
      store.addBlanket({
        name: "护士创建的毯子",
        bedId: "bed-a-01",
      }),
    ).toThrow("仅管理员或开发者可以管理毯子");
    expect(() =>
      store.updateBlanket("sensor-bed-a-01", {
        name: "护士修改的毯子",
        bedId: "bed-a-01",
      }),
    ).toThrow("仅管理员或开发者可以管理毯子");
  });

  it("lets administrators manage camera names and linked bed locations", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");

    const cameraId = store.addManagedCamera({
      name: "302 病房摄像头",
      bedId: "bed-a-03",
    });
    store.updateManagedCamera(cameraId, {
      name: "302 病房北侧摄像头",
      bedId: "bed-a-04",
    });

    expect(store.cameras.find((camera) => camera.id === cameraId)?.name).toBe(
      "302 病房北侧摄像头",
    );
    expect(
      store.bedSummaries.find((summary) => summary.bed.id === "bed-a-04")?.cameras,
    ).toEqual([expect.objectContaining({ id: cameraId })]);
  });

  it("lets only developers rename the platform brand", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");
    expect(() => store.updatePlatformName("康复毯监测中心")).toThrow(
      "仅开发者可以修改平台名称",
    );

    store.setActiveRole("DEVELOPER");
    store.updatePlatformName("康复毯监测中心");
    expect(store.platformName).toBe("康复毯监测中心");
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

  it("lets administrators create role tags and assign them to staff", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");
    store.addStaffTag("责任护士");

    const staffId = store.addStaff({
      username: "nurse-tag",
      displayName: "标签护士",
      role: "NURSE",
      wardIds: ["ward-a"],
      status: "ACTIVE",
      initialPassword: "Nurse@123456",
      tags: ["责任护士", "夜班"],
    });

    expect(store.staffTags).toContain("责任护士");
    expect(store.staff.find((item) => item.id === staffId)?.tags).toEqual([
      "责任护士",
      "夜班",
    ]);
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

  it("batch imports cameras atomically with node addresses and unique stream paths", () => {
    const store = useMonitoringStore();
    store.setActiveRole("DEVELOPER");
    const before = store.cameras.length;

    expect(
      store.addCameraBatch([
        {
          name: "批量摄像头 A",
          cameraKey: "camera-batch-a",
          mediaPath: "camera-batch-a",
          mediaServerUrl: "http://10.208.236.140",
        },
        {
          name: "批量摄像头 B",
          cameraKey: "camera-batch-b",
          mediaPath: "camera-batch-b",
          mediaServerUrl: "http://10.208.236.141",
        },
      ]),
    ).toBe(2);
    expect(store.cameras).toHaveLength(before + 2);

    expect(() =>
      store.addCameraBatch([
        {
          name: "唯一摄像头",
          cameraKey: "camera-unique",
          mediaPath: "camera-unique",
        },
        {
          name: "重复路径",
          cameraKey: "camera-other",
          mediaPath: "camera-unique",
        },
      ]),
    ).toThrow("媒体路径重复");
    expect(store.cameras).toHaveLength(before + 2);
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

  it("restores saved MQTT settings in a new session", () => {
    const store = useMonitoringStore();
    store.setActiveRole("DEVELOPER");
    store.updateMqttSettings({
      ...store.mqttSettings,
      clientId: "persisted-client",
      username: "blanket-device",
    });

    setActivePinia(createPinia());
    const restored = useMonitoringStore();
    expect(restored.mqttSettings.clientId).toBe("persisted-client");
    expect(restored.mqttSettings.username).toBe("blanket-device");
  });

  it("exports a password-free maintenance backup and restores business data", () => {
    const store = useMonitoringStore();
    store.setActiveRole("DEVELOPER", "developer");
    const backup = JSON.parse(
      JSON.stringify(store.buildMonitoringBackup()),
    ) as Record<string, unknown>;

    expect(backup).toMatchObject({
      schemaVersion: 1,
      platformName: store.platformName,
    });
    expect(backup.mqttSettings).not.toHaveProperty("password");

    const backupData = backup.data as {
      beds: Array<{ id: string; patientName?: string }>;
    };
    const firstBed = backupData.beds[0];
    firstBed.patientName = "备份恢复患者";
    store.restoreMonitoringBackup(JSON.stringify(backup));

    expect(store.beds.find((bed) => bed.id === firstBed.id)?.patientName).toBe(
      "备份恢复患者",
    );
  });

  it("replaces stale local alarms with the authoritative server snapshot", () => {
    const store = useMonitoringStore();
    store.ingestAlarm({
      alarmId: "stale-alarm",
      code: "SENSOR_STATE_CHANGED",
      level: "WARNING",
      status: "OPEN",
      title: "旧告警",
      detail: "浏览器本地残留",
      bedId: "bed-a-01",
      wardId: "ward-a",
      roomId: "room-a-301",
      sensorKey: "blanket-001",
      cameraKey: "camera-01",
      occurredAt: "2026-11-05T10:00:00+08:00",
    });
    store.replaceAlarms([
      {
        alarmId: "server-alarm",
        code: "SENSOR_STATE_CHANGED",
        level: "WARNING",
        status: "OPEN",
        title: "服务端告警",
        detail: "服务端权威记录",
        bedId: "bed-a-01",
        wardId: "ward-a",
        roomId: "room-a-301",
        sensorKey: "blanket-001",
        cameraKey: "camera-01",
        occurredAt: "2026-11-05T10:01:00+08:00",
      },
    ]);

    expect(store.alarms.map((alarm) => alarm.alarmId)).toEqual(["server-alarm"]);
  });

  it("migrates the old alarm topic pattern that could not match a bed", () => {
    localStorage.setItem(
      "monitoring-mqtt-settings",
      JSON.stringify({
        alarmTopic: "medical-blanket/v1/+/+/+/+/alarm",
      }),
    );

    const store = useMonitoringStore();
    expect(store.mqttSettings.alarmTopic).toBe("medical-blanket/v1/+/+/+/alarm");
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
    ).toThrow("只能管理级别低于自己的账号");

    expect(() =>
      store.addStaff({
        username: "developer-2",
        displayName: "第二开发者",
        role: "DEVELOPER",
        wardIds: ["ward-a"],
        status: "ACTIVE",
        initialPassword: "Developer@123",
      }),
    ).toThrow("只能创建级别低于自己的账号");
  });

  it("prevents administrators from creating or editing peer administrators", () => {
    const store = useMonitoringStore();
    store.setActiveRole("ADMIN");

    expect(() =>
      store.addStaff({
        username: "admin-2",
        displayName: "第二管理员",
        role: "ADMIN",
        wardIds: ["ward-a"],
        status: "ACTIVE",
        initialPassword: "Admin@123456",
      }),
    ).toThrow("只能创建级别低于自己的账号");

    const peer = store.staff.find((item) => item.role === "ADMIN")!;
    expect(store.canManageMember(peer.id)).toBe(false);
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

  it("lets administrators grant only modules and wards they own", () => {
    const store = useMonitoringStore();
    const member = store.staff.find((item) => item.username === "nurse")!;
    store.setActiveRole("ADMIN");

    store.updateStaff(member.id, {
      username: member.username,
      displayName: member.displayName,
      role: member.role,
      wardIds: member.wardIds,
      status: member.status,
      modulePermissions: ["overview", "beds"],
    });
    expect(store.staff.find((item) => item.id === member.id)?.modulePermissions).toEqual([
      "overview",
      "beds",
    ]);

    expect(() =>
      store.updateStaff(member.id, {
        username: member.username,
        displayName: member.displayName,
        role: member.role,
        wardIds: member.wardIds,
        status: member.status,
        modulePermissions: ["overview", "mqtt"],
      }),
    ).toThrow("只能授予自己拥有的模块权限");

    expect(() =>
      store.updateStaff(member.id, {
        username: member.username,
        displayName: member.displayName,
        role: member.role,
        wardIds: ["ward-not-owned"],
        status: member.status,
      }),
    ).toThrow("只能授予自己已授权的病区");
  });
});
