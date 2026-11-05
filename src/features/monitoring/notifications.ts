export type NotificationLevel = "INFO" | "WARNING" | "CRITICAL";

export interface AlarmNotificationInput {
  alarmId?: string;
  bedId: string;
  level: NotificationLevel;
  message: string;
  occurredAt: string;
}

export interface AlarmNotificationCommand {
  type: "notification";
  alarmId: string;
  level: NotificationLevel;
  title: string;
  bedId: string;
  occurredAt: string;
}

export function buildAlarmNotification(
  input: AlarmNotificationInput,
): AlarmNotificationCommand {
  return {
    type: "notification",
    alarmId: input.alarmId ?? `notify-${input.bedId}`,
    level: input.level,
    title: input.message.trim(),
    bedId: input.bedId,
    occurredAt: input.occurredAt,
  };
}

export async function publishAlarmNotification(
  topic: string,
  input: AlarmNotificationInput,
): Promise<AlarmNotificationCommand> {
  const notification = buildAlarmNotification(input);
  const response = await fetch("/api/developer/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      notification,
    }),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error || `警告下发失败：HTTP ${response.status}`);
  }
  return notification;
}
