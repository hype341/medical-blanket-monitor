import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
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
    ).toThrow("仅管理员可以修改设备绑定");
  });

  it("turns a resolved warning into a resolved alarm state", () => {
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
});
