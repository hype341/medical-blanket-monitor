import { describe, expect, it } from "vitest";
import { buildAlarmNotification } from "./notifications";

describe("MQTT alarm notifications", () => {
  it("builds a simplified bed-level notification for the device", () => {
    const notification = buildAlarmNotification({
      bedId: "bed-a-01",
      level: "WARNING",
      message: "请检查毯子状态",
      occurredAt: "2026-11-05T20:30:00+08:00",
    });

    expect(notification).toEqual({
      type: "notification",
      alarmId: "notify-bed-a-01",
      level: "WARNING",
      title: "请检查毯子状态",
      bedId: "bed-a-01",
      occurredAt: "2026-11-05T20:30:00+08:00",
    });
  });
});
