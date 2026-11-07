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
  alarmTopic: "medical-blanket/v1/+/+/+/+/alarm",
  alarmTitleTemplate: "{{deviceName}} 状态异常",
  alarmDetailTemplate: "{{bedName}} 上报 {{alarmCode}}",
  qos: 1 as const,
};

describe("online documentation", () => {
  it("generates a room alarm topic and simplified payload document", () => {
    const document = generateMqttDocumentation(data, settings, generatedAt);

    expect(document).toContain("medical-blanket/v1/H001/WARD-A/301-01/alarm");
    expect(document).toContain("medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data");
    expect(document).toContain("medical-blanket/v1/+/+/+/sensor/+/data");
    expect(document).toContain("## 设备最短接入（先看这里）");
    expect(document).toContain("设备只使用 TCP MQTT 端口 `1883`");
    expect(document).toContain("设备动作选择“发布”");
    expect(document).toContain('"status": "ONLINE"');
    expect(document).toContain('"data": "ff,aa"');
    expect(document).toContain("不会返回业务 JSON");
    expect(document).not.toContain("遥测主题");
    expect(document).not.toContain('"sensorKey"');
    expect(document).toContain("## 传感器数据报文");
    expect(document).toContain('"metrics": {}');
    expect(document).toContain("| `status` | string |");
    expect(document).toContain('"title": "毯子状态异常"');
    expect(document).toContain("A 病区 · 外科");
    expect(document).toContain("openMqttSensorStream");
    expect(document).toContain("openSensorDataStream");
    expect(document).toContain("openSensorHexStream");
    expect(document).toContain("openSensorRawHexStream");
    expect(document).toContain("getSensorHex");
    expect(document).toContain("getSensorRawHex");
    expect(document).toContain("28 点/列 × 64 列");
    expect(document).toContain("每点 1 字节");
    expect(document).toContain("/api/public/sensors/bed-a-01/hex");
    expect(document).toContain("/api/public/sensors/bed-a-01/raw-hex");
    expect(document).toContain("runSensorProcessors");
    expect(document).toContain("SensorDataProcessor");
    expect(document).toContain("PUBACK");
    expect(document).toContain("medical-blanket/v1/system/time");
    expect(document).toContain("/api/public/time");
    expect(document).toContain("/api/public/sensors/bed-a-01");
  });

  it("generates camera endpoints and room mappings", () => {
    const document = generateVideoDocumentation(data, generatedAt);

    expect(document).toContain("浏览器直接观看");
    expect(document).toContain("http://172.20.10.5:8889/camera-01");
    expect(document).toContain("http://172.20.10.5:8889/camera-01/whep");
    expect(document).toContain("http://172.20.10.5:8888/camera-01/index.m3u8");
    expect(document).toContain("rtsp://172.20.10.5:8554/camera-01");
    expect(document).toContain("rtmp://172.20.10.5:1935/camera-01");
    expect(document).toContain("301 病房 / 01 床");
    expect(document).toContain("openCameraPlaybackStream");
  });
});
