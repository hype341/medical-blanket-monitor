import { describe, expect, it } from "vitest";
import { generateMqttDocumentation, generateVideoDocumentation } from "./documentation";
import { createMonitoringFixture } from "./mock-data";

const generatedAt = "2026-11-04T19:00:00+08:00";
const data = createMonitoringFixture();
const settings = {
  brokerUrl: "mqtt://10.208.236.131:1883",
  websocketUrl: "ws://10.208.236.131:8083/mqtt",
  clientId: "medical-blanket-platform",
  username: "blanket-service",
  password: "secret",
  alarmTopic: "medical-blanket/v1/+/+/+/alarm",
  alarmTitleTemplate: "{{deviceName}} 状态异常",
  alarmDetailTemplate: "{{bedName}} 上报 {{alarmCode}}",
  qos: 1 as const,
};

describe("online documentation", () => {
  it("generates a room alarm topic and simplified payload document", () => {
    const document = generateMqttDocumentation(data, settings, generatedAt);

    expect(document).toContain("medical-blanket/v1/H001/WARD-A/301/alarm");
    expect(document).not.toContain("遥测主题");
    expect(document).not.toContain('"sensorKey"');
    expect(document).toContain("## 传感器数据报文");
    expect(document).toContain('"metrics": {}');
    expect(document).toContain("| `status` | string |");
    expect(document).toContain('"title": "毯子状态异常"');
    expect(document).toContain("A 病区 · 外科");
    expect(document).toContain("openMqttSensorStream");
  });

  it("generates camera endpoints and room mappings", () => {
    const document = generateVideoDocumentation(data, generatedAt);

    expect(document).toContain("http://10.208.236.131:8889/camera-01/whep");
    expect(document).toContain("rtsp://10.208.236.131:8554/camera-01");
    expect(document).toContain("301 病房 / 01 床");
    expect(document).toContain("openCameraPlaybackStream");
  });
});
