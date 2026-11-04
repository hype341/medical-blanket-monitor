export const SENSOR_DATA_TOPIC = "medical-blanket/v1/+/+/+/sensor/+/data";
export const LEGACY_SENSOR_EVENT_TOPIC = "medical-blanket/v1/+/+/+/sensor/+/telemetry";

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

export interface BedDataTopicInput extends RoomMqttTopicInput {
  bedNo: string;
  deviceKey: string;
}

export function buildBedDataTopic(input: BedDataTopicInput): string {
  return [
    "medical-blanket",
    "v1",
    normalize(input.hospitalCode),
    normalize(input.wardCode),
    `${normalize(input.roomNo)}-${normalize(input.bedNo)}`,
    "sensor",
    normalize(input.deviceKey),
    "data",
  ].join("/");
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, "_");
}
