export const SENSOR_EVENT_TOPIC = "medical-blanket/v1/+/+/+/sensor/+/telemetry";

export interface RoomMqttTopicInput {
  hospitalCode: string;
  wardCode: string;
  roomNo: string;
}

export function buildRoomAlarmTopic(input: RoomMqttTopicInput): string {
  return [
    "medical-blanket",
    "v1",
    normalize(input.hospitalCode),
    normalize(input.wardCode),
    normalize(input.roomNo),
    "alarm",
  ].join("/");
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, "_");
}
