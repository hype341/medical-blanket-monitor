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
      } | ${summary?.alarmTopic ?? "未生成"} |`;
    })
    .join("\n");

  const sampleBed = rows[0]?.bed;

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
| 告警订阅 | \`${settings.alarmTopic}\` |

## 第三方直接订阅函数

\`\`\`ts
import { openMqttSensorStream } from "@/features/monitoring/stream-api";

const stream = openMqttSensorStream(settings, {
  onTelemetry(reading) {
    console.log("传感器数据", reading);
  },
  onAlarm(alarm) {
    console.warn("病房告警", alarm.bedId, alarm.title);
  },
  onStatus(status) {
    console.log("MQTT 状态", status);
  },
});

// 页面销毁或停止接收时调用
stream.close();
\`\`\`

## 病房、床位与独立告警 Topic

| 病区 | 病房 | 床位 | 传感器 | 病房告警 Topic |
| --- | --- | --- | --- | --- |
${topicRows}

## 传感器数据报文

传感器图形只依赖设备身份、上报时间和状态。\`metrics\` 保留给后续识别处理器，当前允许为空对象；毯子不要求温度、压力或电量字段。

\`\`\`json
{
  "messageId": "message-01",
  "deviceKey": "${rows[0]?.summary?.sensor?.deviceKey ?? "blanket-001"}",
  "bedId": "${sampleBed?.id ?? "bed-a-01"}",
  "observedAt": "${generatedAt}",
  "status": "ONLINE",
  "metrics": {}
}
\`\`\`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| \`messageId\` | string | 消息唯一标识，用于去重和追踪 |
| \`deviceKey\` | string | 毯子传感器设备标识，必须与设备绑定一致 |
| \`bedId\` | string | 床位标识，用于校验传感器与床位关系 |
| \`observedAt\` | ISO 8601 string | 设备采集时间，包含时区 |
| \`status\` | string | \`ONLINE\`、\`STALE\`、\`OFFLINE\` 或 \`ALARM\`，驱动传感器图形状态 |
| \`metrics\` | object | 识别扩展字段；没有业务指标时传空对象 |

第三方页面或识别服务调用 \`openMqttSensorStream\` 后，在 \`onTelemetry(reading)\` 中直接接收上述数据对象。

## 告警报文示例

告警 Topic 直接归属于病房，报文中的 \`bedId\` 用于定位具体床位。

\`\`\`json
{
  "alarmId": "alarm-01",
  "level": "WARNING",
  "title": "毯子状态异常",
  "bedId": "${sampleBed?.id ?? "bed-a-01"}",
  "occurredAt": "${generatedAt}"
}
\`\`\`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| \`alarmId\` | string | 告警唯一标识，重复上报会覆盖同一条告警 |
| \`level\` | string | \`INFO\`、\`WARNING\` 或 \`CRITICAL\` |
| \`title\` | string | 护士可直接阅读的告警标题 |
| \`bedId\` | string | 告警对应床位，后端据此补全病区、病房和摄像头 |
| \`occurredAt\` | ISO 8601 string | 告警发生时间，包含时区 |
`;
}

export function generateVideoDocumentation(data: MonitoringData, generatedAt: string): string {
  const sections = data.cameras.map((camera) => {
    const linked = data.beds
      .map((bed) => ({ bed, summary: getBedMonitorSummary(bed.id, data) }))
      .filter(({ summary }) => summary?.cameras.some((item) => item.id === camera.id));
    const mappings = linked
      .map(({ bed }) => {
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
