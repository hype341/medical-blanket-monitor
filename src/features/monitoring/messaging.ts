export interface BedMqttTopicInput {
  hospitalCode: string;
  wardCode: string;
  roomNo: string;
  bedNo: string;
  deviceKey: string;
}

export interface BedMqttTopics {
  telemetry: string;
  alarm: string;
}

export function buildBedMqttTopics(input: BedMqttTopicInput): BedMqttTopics {
  const base = [
    "medical-blanket",
    "v1",
    normalize(input.hospitalCode),
    normalize(input.wardCode),
    `${normalize(input.roomNo)}-${normalize(input.bedNo)}`,
  ].join("/");

  return {
    telemetry: `${base}/sensor/${normalize(input.deviceKey)}/telemetry`,
    alarm: [
      "medical-blanket",
      "v1",
      normalize(input.hospitalCode),
      normalize(input.wardCode),
      normalize(input.roomNo),
      "alarm",
    ].join("/"),
  };
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, "_");
}
