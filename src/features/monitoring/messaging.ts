export const SENSOR_DATA_TOPIC = "medical-blanket/v1/+/+/+/sensor/+/data";
export const LEGACY_SENSOR_EVENT_TOPIC = "medical-blanket/v1/+/+/+/sensor/+/telemetry";
export const SYSTEM_TIME_TOPIC = "medical-blanket/v1/system/time";

export interface BedMqttTopicInput {
  hospitalCode: string;
  wardCode: string;
  roomNo: string;
  bedNo: string;
}

export function buildBedAlarmTopic(input: BedMqttTopicInput): string {
  return [
    "medical-blanket",
    "v1",
    normalize(input.hospitalCode),
    normalize(input.wardCode),
    `${normalize(input.roomNo)}-${normalize(input.bedNo)}`,
    "alarm",
  ].join("/");
}

export interface BedDataTopicInput extends BedMqttTopicInput {
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

export function buildSensorDataApiPath(bedId: string): string {
  return `/api/public/sensors/${encodeURIComponent(bedId)}`;
}

export function buildMqttTopicUrl(brokerUrl: string, topic: string): string {
  return `${brokerUrl.replace(/\/+$/, "")}/${topic.replace(/^\/+/, "")}`;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, "_");
}
