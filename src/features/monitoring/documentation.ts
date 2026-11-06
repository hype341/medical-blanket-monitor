import type { MonitoringData, MqttSettings } from "./types";
import { buildBedMonitorSummaries, getBedMonitorSummary } from "./selectors";
import { getCameraMediaEndpoints } from "./media-endpoints";
import { buildSensorDataApiPath, SENSOR_DATA_TOPIC, SYSTEM_TIME_TOPIC } from "./messaging";

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
      } | ${summary?.dataTopic ?? "未生成"} | ${
        summary?.dataTopic ? buildSensorDataApiPath(bed.id) : "未生成"
      } | ${summary?.alarmTopic ?? "未生成"} |`;
    })
    .join("\n");

  const sampleRow = rows.find(({ summary }) => Boolean(summary?.dataTopic)) ?? rows[0];
  const sampleBed = sampleRow?.bed;
  const sampleSensor = sampleRow?.summary?.sensor;
  const sampleDataTopic =
    sampleRow?.summary?.dataTopic ??
    "medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data";
  const sampleAlarmTopic =
    sampleRow?.summary?.alarmTopic ?? "medical-blanket/v1/H001/WARD-A/301-01/alarm";
  const sampleDeviceKey = sampleSensor?.deviceKey ?? "blanket-001";
  const sampleBedId = sampleBed?.id ?? "bed-a-01";
  const sampleClientId = `esp32-${sampleDeviceKey}`;

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
| 传感器数据订阅 | \`${SENSOR_DATA_TOPIC}\` |
| 告警订阅 | \`${settings.alarmTopic}\` |
| 服务器时间 Topic | \`${SYSTEM_TIME_TOPIC}\` |

## 设备最短接入（先看这里）

平台每新增一张床位，会自动创建一条毯子传感器、一条数据主题和一条告警主题。设备端按下面四步接入，不需要手工拼接主题。

### 1. 连接 Broker

| 设备端填写项 | 当前值 |
| --- | --- |
| 服务器地址 | \`${settings.brokerUrl}\` |
| 用户名 | \`${settings.username}\` |
| 密码 | \`${settings.password}\` |
| Client ID 建议 | \`${sampleClientId}\` |

设备只使用 TCP MQTT 端口 \`1883\` 发布数据，不需要连接 WebSocket，也不需要订阅自己的数据主题。

### 2. 发布到当前床位主题

\`\`\`text
${sampleDataTopic}
\`\`\`

设备动作选择“发布”。当前主题对应床位：\`${sampleBedId}\`，传感器：\`${sampleSensor?.name ?? sampleDeviceKey}\`。

### 3. 发送最小数据报文

\`\`\`json
{
  "messageId": "message-01",
  "deviceKey": "${sampleDeviceKey}",
  "bedId": "${sampleBedId}",
  "status": "ONLINE",
  "data": "ff,aa",
  "metrics": {}
}
\`\`\`

不需要在设备上获取时间。\`observedAt\` 可以省略，平台收到消息后会补充 \`+08:00\` 服务器时间；设备已经有时钟时也可以主动上报。

### 4. 确认发送结果

| QoS | 设备会收到什么 | 建议 |
| --- | --- | --- |
| \`0\` | 不返回任何消息 | 高频连续上报，延迟最低 |
| \`1\` | 仅一个标准空 \`PUBACK\` | 需要确认 Broker 已接收时使用 |

不会返回业务 JSON，也不会附加时间字段，不需要另建返回主题。告警直接发布到当前床位告警主题：

\`\`\`text
${sampleAlarmTopic}
\`\`\`

## 平台向设备下发警告

设备需要订阅当前床位告警主题。开发者在开发者工作台选择床位、级别并填写内容后，平台通过服务器端 MQTT 账号发布通知：

\`\`\`json
{
  "type": "notification",
  "alarmId": "developer-notify-1730000000000",
  "level": "WARNING",
  "title": "请检查当前床位毯子状态",
  "bedId": "${sampleBedId}",
  "occurredAt": "2026-11-05T21:00:00+08:00"
}
\`\`\`

设备端只处理 \`type = notification\` 的消息；MQTT 账号必须拥有该床位告警主题的订阅权限。

## 第三方直接订阅函数

全部传感器订阅：

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

单个传感器订阅：

\`\`\`ts
import { openSensorDataStream } from "@/features/monitoring/stream-api";

const sensorStream = openSensorDataStream(
  settings,
  "${sampleDataTopic}",
  {
    onData(reading) {
      console.log("单床位传感器数据", reading);
    },
    onError(error) {
      console.error("传感器连接失败", error);
    },
  },
);

// 停止接收时调用
sensorStream.close();
\`\`\`

## 纯十六进制数据函数

第三方只需要原始十六进制字符串时，直接调用下面三个接口，不必再解析完整报文：

\`\`\`ts
import {
  extractFullRawFrameHex,
  extractSensorHexData,
  getSensorHex,
  getSensorRawHex,
  openSensorHexStream,
  openSensorRawHexStream,
} from "@/features/monitoring/stream-api";

// 1. HTTP 读取当前床位，只返回中间 1792 字节数据
const hex = await getSensorHex("${sampleBedId}");

// 2. MQTT 实时订阅，onHex 只收到 1792 字节十六进制
const stream = openSensorHexStream(
  settings,
  "${sampleDataTopic}",
  {
    onHex(hex) {
      console.log("纯十六进制数据", hex);
    },
  },
);

// 3. 读取包含帧头、类型和校验的原始整帧
const rawHex = await getSensorRawHex("${sampleBedId}");
const rawStream = openSensorRawHexStream(settings, "${sampleDataTopic}", {
  onHex(value) {
    console.log("原始帧", value);
  },
});

// 4. 已有 reading 对象时，直接提取 1792 字节数据或完整原始帧
const sameHex = extractSensorHexData(reading);
const sameRawHex = extractFullRawFrameHex(reading.metrics.rawFrame ?? []);

stream.close();
rawStream.close();
\`\`\`

纯数据 HTTP 地址：\`/api/public/sensors/{bedId}/hex\`。响应内容类型为
\`text/plain\`，只返回去掉 \`FF AA 07 07\`、类型字节和末尾校验后的 1792 字节数据。
原始整帧地址：\`/api/public/sensors/{bedId}/raw-hex\`，返回完整帧，包括帧头、类型和校验。
当前床位纯数据：\`/api/public/sensors/${sampleBedId}/hex\`；原始帧：
\`/api/public/sensors/${sampleBedId}/raw-hex\`。

### 28 × 64 热力图

1792 个压力点按行优先排列，每点 1 字节，取值范围 \`00\`–\`ff\`。
前端按 28 列、64 行绘制：最低值显示白色，压力升高依次过渡为黄色、橙色，
最高值显示红色。

\`\`\`ts
import { buildSensorHeatmap } from "@/features/monitoring/sensor-heatmap";

const heatmap = buildSensorHeatmap(hexData);
console.log(heatmap.columns, heatmap.rows, heatmap.values.length);
\`\`\`

## 床位数据与告警 Topic

每张床位分别拥有独立的数据 Topic 和告警 Topic。

| 病区 | 病房 | 床位 | 传感器 | 床位数据 Topic | 数据 API | 床位告警 Topic |
| --- | --- | --- | --- | --- | --- | --- |
${topicRows}

## 传感器数据报文

传感器图形只依赖设备身份、上报时间和状态。\`data\` 只放设备原始数据，统一使用小写十六进制、逗号分隔，例如 \`ff,aa\`；其他报文内容保持正常 JSON 字段。\`metrics\` 保留给后续识别处理器，当前允许为空对象。

\`observedAt\` 可以省略，平台收到消息后会使用服务器时间补充。服务器时间也可以通过 MQTT 保留主题 \`${SYSTEM_TIME_TOPIC}\` 或 HTTP 接口 \`/api/public/time\` 获取。

\`\`\`json
{
  "messageId": "message-01",
  "deviceKey": "${sampleDeviceKey}",
  "bedId": "${sampleBedId}",
  "observedAt": "${generatedAt}",
  "status": "ONLINE",
  "data": "ff,aa",
  "metrics": {}
}
\`\`\`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| \`messageId\` | string | 消息唯一标识，用于去重和追踪 |
| \`deviceKey\` | string | 毯子传感器设备标识，必须与设备绑定一致 |
| \`bedId\` | string | 床位标识，用于校验传感器与床位关系 |
| \`observedAt\` | ISO 8601 string（可选） | 设备采集时间；省略时由服务器补充 \`+08:00\` 时间 |
| \`status\` | string | \`ONLINE\`、\`STALE\`、\`OFFLINE\` 或 \`ALARM\`，驱动传感器图形状态 |
| \`data\` | string | 传感器原始数据，只在这一字段使用小写十六进制并以逗号分隔，例如 \`ff,aa\` |
| \`metrics\` | object | 识别扩展字段；没有业务指标时传空对象 |

第三方页面或识别服务调用 \`openMqttSensorStream\` 后，在 \`onTelemetry(reading)\` 中直接接收上述数据对象。

## 传感器数据处理扩展

原始数据和识别结果保持分离。后续新增毯子状态、离床、跌倒或其他规则时，只需要增加处理器：

\`\`\`ts
import {
  openSensorDataStream,
  type SensorDataStreamHandlers,
} from "@/features/monitoring/stream-api";
import {
  runSensorProcessors,
  type SensorDataProcessor,
} from "@/features/monitoring/processing";

const processors: SensorDataProcessor[] = [
  {
    id: "blanket-state-processor",
    analyze(reading) {
      return reading.status === "ALARM"
        ? [
            {
              code: "BLANKET_ALARM",
              severity: "WARNING",
              title: "毯子状态异常",
              bedId: reading.bedId,
            },
          ]
        : [];
    },
  },
];

const handlers: SensorDataStreamHandlers = {
  async onData(reading) {
    const findings = await runSensorProcessors(reading, processors);
    console.log("识别结果", findings);
  },
};

openSensorDataStream(settings, dataTopic, handlers);
\`\`\`

处理器通过 \`SensorDataProcessor\` 接口扩展，\`runSensorProcessors\` 会并行执行已注册处理器并返回统一的 \`DataFinding[]\`。

## 设备发布确认

设备只需要上报数据时使用 \`QoS 0\`，不返回任何消息。设备需要确认 Broker 已接收时使用 \`QoS 1\`，Broker 只返回一个标准的空 \`PUBACK\`，不会返回业务 JSON 或附加时间字段。不要为简单确认额外建立返回 Topic。

## 告警报文示例

告警 Topic 直接归属于床位，报文中的 \`bedId\` 用于二次校验。

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
  const bedLocationsByCamera = new Map<string, string[]>();
  for (const summary of buildBedMonitorSummaries(data)) {
    const location = `- ${summary.ward?.name ?? "-"} / ${summary.room?.name ?? "-"} / ${summary.bed.bedNo} 床`;
    for (const camera of summary.cameras) {
      const locations = bedLocationsByCamera.get(camera.id) ?? [];
      locations.push(location);
      bedLocationsByCamera.set(camera.id, locations);
    }
  }

  const sections = data.cameras.map((camera) => {
    const mappings = (bedLocationsByCamera.get(camera.id) ?? []).join("\n");
    const endpoints = getCameraMediaEndpoints(camera);

    return `## ${camera.name}

- 设备标识：\`${camera.cameraKey}\`
- MediaMTX 路径：\`${endpoints.mediaPath}\`
- 设备状态：\`${camera.status}\`
- 摄像头上行推流：\`${endpoints.rtmpUrl}\`
- 浏览器直接观看：\`${endpoints.webRtcViewUrl}\`
- WebRTC：\`${endpoints.webRtcUrl}\`
- HLS：\`${endpoints.hlsUrl}\`
- RTSP：\`${endpoints.rtspUrl}\`
- 回放索引：\`${endpoints.playbackApiBaseUrl}/list?path=${endpoints.mediaPath}&start={开始时间}&end={结束时间}\`

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
