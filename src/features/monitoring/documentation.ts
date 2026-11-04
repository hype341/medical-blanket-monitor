import type { MonitoringData, MqttSettings } from "./types";
import { getBedMonitorSummary } from "./selectors";

export function generateMqttDocumentation(
  data: MonitoringData,
  settings: MqttSettings,
  generatedAt: string,
): string {
  const rows = data.beds.map((bed) => {
    const summary = getBedMonitorSummary(bed.id, data);
    return { bed, summary };
  });

  const topicRows = rows
    .map(({ bed, summary }) => {
      const ward = data.wards.find((item) => item.id === bed.wardId);
      const room = data.rooms.find((item) => item.id === bed.roomId);
      return `| ${ward?.name ?? "-"} | ${room?.roomNo ?? "-"} | ${bed.bedNo} | ${
        summary?.sensor?.deviceKey ?? "未绑定"
      } | ${summary?.telemetryTopic ?? "未生成"} | ${summary?.alarmTopic ?? "未生成"} |`;
    })
    .join("\n");

  const firstSensorBed = rows.find(({ summary }) => summary?.sensor);
  const sampleSensor = firstSensorBed?.summary?.sensor;
  const sampleBed = firstSensorBed?.bed;

  return `# 医用智能毯平台 MQTT 连接文档

生成时间：${generatedAt}

## Broker 配置

| 属性 | 值 |
| --- | --- |
| Broker 地址 | \`${settings.brokerUrl}\` |
| WebSocket | \`${settings.websocketUrl}\` |
| Client ID | \`${settings.clientId}\` |
| 用户名 | \`${settings.username}\` |
| 密码 | \`${settings.password}\` |
| QoS | \`${settings.qos}\` |
| 遥测订阅 | \`${settings.telemetryTopic}\` |
| 告警订阅 | \`${settings.alarmTopic}\` |

## 第三方直接订阅函数

\`\`\`ts
import { openMqttSensorStream } from "@/features/monitoring/stream-api";

const stream = openMqttSensorStream(settings, {
  onTelemetry(reading) {
    console.log("传感器数据", reading);
  },
  onAlarm(alarm) {
    console.warn("床位告警", alarm.bedId, alarm.title);
  },
  onStatus(status) {
    console.log("MQTT 状态", status);
  },
});

// 页面销毁或停止接收时调用
stream.close();
\`\`\`

## 病房、床位与独立 Topic

| 病区 | 病房 | 床位 | 传感器 | 遥测 Topic | 告警 Topic |
| --- | --- | --- | --- | --- | --- |
${topicRows}

## 遥测报文示例

\`\`\`json
{
  "messageId": "01J9Z1W5QJ0B7W8P5F3D2K1N6M",
  "deviceKey": "${sampleSensor?.deviceKey ?? "blanket-001"}",
  "bedId": "${sampleBed?.id ?? "bed-a-01"}",
  "observedAt": "${generatedAt}",
  "status": "ONLINE",
  "metrics": {},
  "events": []
}
\`\`\`

## 告警报文示例

\`\`\`json
{
  "alarmId": "alarm-01",
  "level": "WARNING",
  "title": "毯子状态异常",
  "bedId": "${sampleBed?.id ?? "bed-a-01"}",
  "occurredAt": "${generatedAt}"
}
\`\`\`
`;
}

export function generateVideoDocumentation(data: MonitoringData, generatedAt: string): string {
  const sections = data.cameras.map((camera) => {
    const linked = data.beds
      .map((bed) => ({ bed, summary: getBedMonitorSummary(bed.id, data) }))
      .filter(({ summary }) => summary?.cameras.some((item) => item.id === camera.id));
    const mappings = linked
      .map(({ bed, summary }) => {
        const ward = data.wards.find((item) => item.id === bed.wardId);
        const room = data.rooms.find((item) => item.id === bed.roomId);
        return `- ${ward?.name ?? "-"} / ${room?.name ?? "-"} / ${bed.bedNo} 床`;
      })
      .join("\n");
    const mediaPath = camera.mediaPath ?? camera.cameraKey;

    return `## ${camera.name}

- 设备标识：\`${camera.cameraKey}\`
- MediaMTX 路径：\`${mediaPath}\`
- 设备状态：\`${camera.status}\`
- WebRTC：\`${camera.playback?.webrtcUrl ?? `http://10.208.236.131:8889/${mediaPath}/whep`}\`
- HLS：\`${camera.playback?.hlsUrl ?? `http://10.208.236.131:8888/${mediaPath}/index.m3u8`}\`
- RTSP：\`rtsp://10.208.236.131:8554/${mediaPath}\`
- 回放索引：\`http://10.208.236.131:9996/list?path=${mediaPath}&start={开始时间}&end={结束时间}\`

### 第三方直接播放函数

\`\`\`ts
import { openCameraPlaybackStream } from "@/features/monitoring/stream-api";

const controller = await openCameraPlaybackStream(
  playback,
  document.querySelector("video")!,
  {
    onReady(mediaStream, protocol) {
      console.log("视频线路已连接", protocol, mediaStream);
    },
    onError(error) {
      console.error("视频连接失败", error);
    },
  },
);

// 页面销毁或停止播放时调用
controller.close();
\`\`\`

对应床位：
${mappings || "- 尚未绑定床位"}
`;
  });

  return `# 医用智能毯平台视频连接文档

生成时间：${generatedAt}

${sections.join("\n")}`;
}
