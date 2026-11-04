# 医用智能毯安全监护平台设计

**状态：** 已确认核心业务边界，待用户评审设计文档

**日期：** 2026-11-04

## 1. 目标

建设一套面向医院病区的通用毯子传感器与视频监护平台。平台以病床为业务绑定中心，把毯子传感器、摄像头、患者和护士工作站关联起来。护士登录后只能查看自己负责病区的设备；管理员可以维护医院、病区、病房、床位、设备和绑定关系。

平台不绑定某个摄像头品牌或毯子传感器品牌。摄像头通过标准媒体协议接入，传感器通过标准 MQTT 消息接入，前端只依赖平台 API。

## 2. 核心约束

- 当前部署只有一路摄像头。有视频监护的床位由一个毯子传感器与这一路摄像头成组绑定。
- 一个活跃绑定必须关联明确的床位，不能只关联病房。
- 护士权限按病区分配，普通护士不能查看未授权病区。
- 摄像头源地址、用户名和密码只允许保存在后端，禁止下发到浏览器。
- 前端播放器优先使用低延迟 WebRTC，其次 HLS，再使用 HTTP-FLV。
- 传感器数据采用可扩展指标模型，不把温度作为唯一指标。
- 设备离线、传感器无数据和视频不可播放必须显示明确状态。
- 外部公开 API 使用独立密钥、限流和只读权限，不复用登录 JWT。
- 当前摄像头地址 `10.208.236.131` 暂不可达，真实 RTSP 参数在链路恢复后录入，不在代码中写死。

## 3. 名称与范围

产品名称统一为：**医用智能毯安全监护平台**。

本设计覆盖：

- 用户登录、角色和病区权限。
- 医院、病区、病房、床位管理。
- 毯子传感器与摄像头设备档案。
- 床位、传感器、摄像头和患者的绑定管理。
- 传感器实时数据、历史数据和通信状态。
- 单路摄像头实时预览、录像回放和告警片段定位。
- 护士工作台、设备列表、绑定管理和基础系统管理。
- Nginx、Spring Boot、MySQL、Redis、MQTT 和媒体服务的部署边界。

本设计不覆盖：

- 医学诊断结论或自动处方。
- 人脸识别、步态识别等视频 AI 算法。
- 多医院 SaaS 计费和跨组织数据共享。
- 厂商私有云 API 的专属对接。

## 4. 总体架构

```text
毯子传感器 --MQTT--> EMQX --> Spring Boot
                                  |--> MySQL（历史数据、业务数据）
                                  |--> Redis（最新值、在线状态、会话缓存）
                                  |--> WebSocket（实时推送）

摄像头 --RTSP/RTMP/SRT--> MediaMTX --> WebRTC/HLS/HTTP-FLV
                                |
                              Nginx

浏览器 --HTTPS--> Nginx --/api--> Spring Boot
                         --/live--> MediaMTX
                         --其余--> Vue 3 静态文件
```

各组件职责：

- **Vue 3 前端：** 登录、护士工作台、床位详情、设备管理、绑定关系、所有已授权摄像头预览。
- **Spring Boot 后端：** 认证授权、业务模型、设备适配配置、MQTT 订阅、实时推送、播放地址签发、公开 API。
- **MySQL：** 用户、组织、床位、设备、绑定、传感器历史读数和审计记录。
- **Redis：** 每个传感器的最新读数、设备在线状态、短期播放授权和 MQTT 离线补偿。
- **EMQX：** 毯子传感器 MQTT 消息入口。
- **MediaMTX：** 拉取 RTSP 或接收 RTMP/SRT，统一输出浏览器可播放协议。
- **Nginx：** 静态资源、API 反向代理、视频流反向代理和访问日志。

## 5. 业务模型

### 5.1 组织与床位

```text
Hospital 1 -> N Ward
Ward 1 -> N Room
Room 1 -> N Bed
Bed N <-> N SensorDevice
Bed N <-> N Camera
Bed 0..1 -> Patient
```

`Bed` 是监护中心对象。病房用于展示分组，床位用于设备绑定、传感器数据和摄像头定位。

建议字段：

- `hospital`: `id`, `name`, `code`, `status`
- `ward`: `id`, `hospital_id`, `name`, `code`, `status`
- `room`: `id`, `ward_id`, `room_no`, `name`, `status`
- `bed`: `id`, `room_id`, `bed_no`, `display_name`, `patient_name`, `status`
- `user`: `id`, `username`, `password_hash`, `display_name`, `status`
- `user_ward`: `user_id`, `ward_id`
- `role`: `NURSE`, `HEAD_NURSE`, `ADMIN`

### 5.2 设备

`sensor_device`：

- `id`, `device_key`, `name`, `vendor`, `model`
- `protocol`: 当前固定为 `MQTT`
- `mqtt_topic`
- `metric_schema_json`
- `status`, `last_seen_at`

`camera`：

- `id`, `camera_key`, `name`, `vendor`, `model`
- `source_protocol`: `RTSP_PULL`, `RTMP_PUSH`, `SRT_PUSH`
- `source_url_encrypted`
- `source_username_encrypted`
- `source_password_encrypted`
- `media_path`
- `enabled`, `status`, `last_seen_at`

摄像头的 `source_url_encrypted` 只由后端解密并交给 MediaMTX 配置生成器。前端只能看到平台播放地址。

### 5.3 绑定

`device_binding`：

- `id`, `bed_id`, `sensor_device_id`, `camera_id`
- `role`: `PRIMARY_SENSOR`, `PRIMARY_CAMERA`
- `active_from`, `active_to`
- `status`, `created_by`

绑定记录保留历史。查询当前关系时只返回 `status=ACTIVE` 且当前时间位于有效区间内的记录。重新绑定不会覆盖旧记录。

### 5.4 传感器展示与数据处理

当前毯子传感器没有温度、电量或其他已验证的业务指标。前端只显示一个传感器设备图形、设备名称、设备编号和连接状态，不展示推测出来的实时数值。

传感器原始消息和历史数据保留通用接口：

- `SensorTelemetrySource` 接收标准化 MQTT 遥测消息。
- `SensorDataProcessor` 接收遥测消息并返回识别结果。
- `CameraFrameSource` 接收标准化视频帧。
- `VideoFrameProcessor` 接收视频帧并返回识别结果。
- 传感器图形刷新频率可配置为 1 Hz、5 Hz、10 Hz 或 25 Hz。

后续离床、跌倒或厂商定义的其他识别规则均以处理器插件接入，不修改传感器图形和床位业务模型。识别结果使用统一的 `DataFinding` 结构，包含编码、严重程度、标题、详情、床位、设备和时间等字段。

## 6. 角色与权限

| 能力 | 护士 NURSE | 护士长 HEAD_NURSE | 管理员 ADMIN | 开发者 DEVELOPER |
| --- | --- | --- | --- | --- |
| 查看授权病区实时数据 | 是 | 是 | 是 | 是 |
| 查看授权病区摄像头 | 是 | 是 | 是 | 是 |
| 查看历史曲线 | 是 | 是 | 是 | 是 |
| 新增床位 | 是 | 是 | 是 | 是 |
| 修改患者信息和患者状态 | 授权病区 | 授权病区 | 全部 | 全部 |
| 管理病区、病房和床位位置 | 否 | 否 | 全部 | 全部 |
| 管理人员账号、角色、密码和病区授权 | 否 | 否 | 全部 | 全部 |
| 管理床位设备绑定 | 否 | 否 | 否 | 全部 |
| 管理摄像头与传感器设备档案 | 否 | 否 | 否 | 全部 |
| 修改告警与录像策略 | 否 | 否 | 全部 | 全部 |
| 查看 MQTT 属性、主题、账户和密码 | 否 | 否 | 否 | 全部 |
| 查看原始 MQTT 报文、服务状态和接口密钥 | 否 | 否 | 否 | 全部 |

后端在每个业务查询中按用户已授权病区过滤，不能只依赖前端隐藏菜单。

## 7. 前端信息架构

### 7.1 页面路由

- `/login`：账号密码登录。
- `/overview`：病区安全总览，显示床位状态、告警、在线率。
- `/beds`：护士工作台，按病区、病房筛选床位卡片。
- `/beds/:bedId`：床位详情，左侧视频、回放与告警，右侧传感器图形、刷新频率和识别扩展位。
- `/monitor`：当前唯一摄像头的实时监控与回放入口。
- `/devices/sensors`：毯子传感器列表与状态。
- `/devices/cameras`：摄像头列表、接入协议、媒体路径和连通状态。
- `/bindings`：床位设备绑定管理。
- `/admin/wards`：管理员/开发者维护病区和病房。
- `/admin/staff`：管理员/开发者维护人员账号、角色、密码状态和病区授权。
- `/admin/policy`：管理员/开发者维护告警片段和滚动录像保留策略。
- `/admin/connections`：开发者维护 MQTT 地址、账户、密码、Topic 和 QoS。
- `/admin/developer`：开发者查看服务状态、MQTT 原始报文和接口密钥。
- `/system/users`：用户、角色和病区授权。
- `/system/audit`：绑定、设备和登录审计。

### 7.2 护士主流程

1. 护士登录。
2. 系统返回其负责病区。
3. 工作台按病房分组显示床位卡片。
4. 卡片展示传感器设备图形、连接状态和是否完成摄像头成组绑定。
5. 点击卡片进入床位详情。
6. 详情页并行加载传感器连接状态、摄像头播放清单、录像分段和告警时间线。
7. 当前没有实时数据或录像时显示明确空状态，不生成模拟数值或假进度。

### 7.3 视觉方向

- 产品定位于医疗安全监护，不采用娱乐直播风格。
- 以浅色中性背景、深蓝绿状态色和红色告警色为主。
- 页面优先突出“哪个病房、哪张床、是否在线、是否有异常”。
- 桌面端采用左侧导航和多栏工作区，移动端变为单列卡片。

## 8. 通用视频接入

### 8.1 摄像头接入适配

第一版支持以下标准输入：

- `RTSP_PULL`：MediaMTX 从摄像头主动拉取 RTSP。
- `RTMP_PUSH`：设备或编码器推送到 MediaMTX。
- `SRT_PUSH`：设备或编码器推送到 MediaMTX。

后续可通过新增适配器支持 ONVIF 设备发现、GB/T 28181 和厂商 SDK，不影响业务绑定模型。

每路摄像头拥有稳定 `camera_key`，MediaMTX 路径为：

```text
cam/{camera_key}
```

### 8.2 播放协议优先级

播放接口返回全部可用地址，前端按以下顺序自动选择：

1. WebRTC：低延迟，适合护士实时查看。
2. HLS：兼容性好，网络抖动时更稳定。
3. HTTP-FLV：供支持 FLV 的媒体服务或设备网关使用。

前端播放器接口：

```ts
interface CameraPlayback {
  cameraId: string
  cameraName: string
  preferredProtocol: "webrtc" | "hls" | "flv"
  webrtcUrl: string | null
  hlsUrl: string | null
  flvUrl: string | null
  expiresAt: string
}
```

播放器行为：

- WebRTC 使用浏览器原生 `RTCPeerConnection` 或 MediaMTX WHEP 接口。
- HLS 使用 `hls.js`，Safari 原生 HLS 作为回退。
- FLV 使用 `flv.js`，仅在地址可用时加载，避免额外依赖影响首屏。
- 任何协议失败时自动切换下一协议，并显示“正在切换视频线路”。
- 所有协议都失败时显示设备状态和重试按钮，不伪装为在线。
- 组件销毁时断开播放器、WebRTC 连接和网络请求。

### 8.3 视频鉴权

浏览器先请求：

```http
POST /api/v1/cameras/{cameraId}/playback-token
Authorization: Bearer {jwt}
```

后端校验病区权限后签发短期播放 token，并返回播放地址。Nginx 在 `/live/` 请求中向 Spring Boot 校验 token，校验通过后才代理到 MediaMTX。

摄像头源凭证永远不进入播放地址。

### 8.4 录像回放与告警片段

MediaMTX 负责持续生成录像分段，后端提供分段索引和短期播放地址。前端时间轴按服务端保留期滚动前进，过期分段从时间轴消失。

前端回放接口：

```ts
interface RecordingTimelineSource {
  query(cameraKey: string, startAt: string, endAt: string): Promise<RecordingSegment[]>
}

interface RecordingClipService {
  requestClip(
    alarm: AlarmEnvelope,
    window: { startAt: string; endAt: string },
  ): Promise<{ clipId: string; status: "PENDING" | "READY" | "FAILED" }>
}
```

回放时间轴支持向前和向后定位、播放暂停、按时间拖动以及点击告警点跳转。当前未接入录像时只显示“暂无录像片段”，不生成假进度。

## 9. MQTT 与 WebSocket

### 9.1 Topic

统一 Topic：

```text
medical-blanket/v1/{hospitalCode}/{wardCode}/{bedCode}/sensor/{deviceKey}/telemetry
```

示例：

```text
medical-blanket/v1/h001/ward-a/03-12/sensor/blanket-001/telemetry
```

后端订阅：

```text
medical-blanket/v1/+/+/+/sensor/+/telemetry
```

### 9.2 消息体

```json
{
  "messageId": "01J9Z1W5QJ0B7W8P5F3D2K1N6M",
  "deviceKey": "blanket-001",
  "observedAt": "2026-11-04T16:30:00+08:00",
  "status": "ONLINE",
  "metrics": {
    "surfaceTemperature": 33.4,
    "bodyTemperature": 36.7,
    "pressure": 4.82
  },
  "batteryPercent": 86,
  "signalStrength": -63
}
```

处理规则：

- 使用 `messageId` 做幂等去重。
- Topic 中的设备和床位必须与有效绑定一致。
- 指标必须出现在设备模板定义中。
- 接收时间与设备观测时间分开保存。
- MQTT 入站成功后，先更新 Redis 和 WebSocket，再异步批量写 MySQL。

### 9.3 告警主题

告警主题：

```text
medical-blanket/v1/{hospitalCode}/{wardCode}/{bedCode}/alarm/{alarmCode}
```

告警消息：

```json
{
  "alarmId": "alarm-01",
  "code": "SENSOR_STATE_CHANGED",
  "level": "WARNING",
  "status": "OPEN",
  "title": "传感器状态异常",
  "detail": "设备上报状态变化",
  "sensorKey": "blanket-001",
  "cameraKey": "camera-01",
  "bedId": "bed-a-01",
  "occurredAt": "2026-11-04T17:04:20+08:00"
}
```

Java 后端收到告警后：

1. 保存告警编码、标题、详情、设备和发生时间。
2. 通过 WebSocket 推送到已授权病区的护士工作台。
3. 按默认“前 30 秒、后 60 秒”时间窗请求 MediaMTX 生成独立录像片段。
4. 保存片段索引、存储位置、创建状态和保留截止时间。
5. 前端在告警时间线和录像时间轴同一时间点显示定位标记。

告警状态为 `OPEN`、`ACKNOWLEDGED` 或 `RESOLVED`。未解决告警统一显示红色；护士标记解决后写入 `resolvedAt`，告警卡片和对应时间轴标记变为绿色。

### 9.4 WebSocket

浏览器连接：

```text
/api/v1/realtime/ws?token={短期实时token}
```

推送消息：

```json
{
  "type": "sensor.reading",
  "bedId": "bed-001",
  "deviceKey": "blanket-001",
  "observedAt": "2026-11-04T16:30:00+08:00",
  "status": "ONLINE",
  "metrics": {},
  "events": [],
  "displayRefreshFps": 1
}
```

断线后前端指数退避重连，并重新请求最新快照。

## 10. API 边界

### 10.1 登录与用户

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/users/me
GET    /api/v1/users/me/wards
```

### 10.2 病区与床位

```text
GET    /api/v1/wards
GET    /api/v1/rooms?wardId=
GET    /api/v1/beds?wardId=&roomId=&status=
GET    /api/v1/beds/{bedId}
GET    /api/v1/beds/{bedId}/monitor
GET    /api/v1/beds/{bedId}/sensor-readings?from=&to=
```

`/beds/{bedId}/monitor` 一次返回床位、传感器图形所需的设备信息、在线状态、唯一摄像头播放清单、录像分段和告警摘要，减少护士详情页的串行请求。

### 10.3 设备与绑定

```text
GET    /api/v1/sensors
POST   /api/v1/sensors
PUT    /api/v1/sensors/{sensorId}
GET    /api/v1/cameras
POST   /api/v1/cameras
PUT    /api/v1/cameras/{cameraId}
DELETE /api/v1/cameras/{cameraId}
GET    /api/v1/bindings
POST   /api/v1/bindings
PUT    /api/v1/bindings/{bindingId}/deactivate
```

### 10.4 公开只读 API

```text
GET /api/public/v1/beds?key={apiKey}
GET /api/public/v1/sensors/{deviceKey}?key={apiKey}
GET /api/public/v1/cameras/{cameraKey}/playback?key={apiKey}
```

公开 API 只返回调用方被授权医院和病区的数据，响应不包含摄像头源凭证。

## 11. 异常与降级

- MySQL 短暂不可用：实时数据继续进入 Redis 和 WebSocket，历史写入进入待重试队列。
- Redis 不可用：业务查询回退 MySQL 最新快照，并显示“实时状态暂不可用”。
- EMQX 离线：床位数据保留最后更新时间，状态超过阈值后变为 `STALE`。
- MediaMTX 离线：摄像头显示离线，传感器数据仍正常工作。
- 当前摄像头失败：只影响实时画面、回放和告警片段，不阻塞传感器图形。
- WebSocket 断开：前端继续使用最近一次快照，并显示重连状态。
- MQTT 消息重复：按 `messageId` 丢弃重复写入。
- 绑定冲突：同一床位同一角色只能有一个活跃主传感器或主摄像头。

## 12. 安全

- 用户密码使用 BCrypt。
- JWT 使用短期访问令牌和长期刷新令牌。
- 摄像头密码使用 AES-GCM 或外部密钥管理服务加密。
- 播放 token 和实时 token 有效期不超过 5 分钟。
- 外部 API key 使用哈希保存，支持撤销和限流。
- Nginx 只暴露前端、`/api` 和 `/live`，MySQL、Redis、EMQX 管理端和 MediaMTX API 不直接暴露公网。
- 所有设备绑定、设备变更、公开 API 创建和登录失败写入审计日志。
- 前端不打印 Token、摄像头密码或完整播放凭证。

## 13. 部署端口

| 组件 | 内部端口 | 对外策略 |
| --- | --- | --- |
| Nginx | 80/443 | 对外 |
| Vue 静态文件 | 由 Nginx 提供 | 对外 |
| Spring Boot | 8080 | 仅本机或容器网络 |
| MySQL | 3306 | 不对外 |
| Redis | 6379 | 不对外 |
| EMQX MQTT | 1883 | 按设备网络开放 |
| EMQX WebSocket | 8083 | 可选开放 |
| EMQX Dashboard | 18083 | 仅管理网络 |
| MediaMTX RTSP | 8554 | 仅受信网络 |
| MediaMTX HLS | 8888 | 通过 Nginx `/live` |
| MediaMTX WebRTC | 8889 | 通过 Nginx `/live` 或受控端口 |

## 14. 测试策略

- 后端单元测试覆盖病区权限过滤、有效绑定、MQTT 幂等和播放 token。
- 集成测试使用真实 MySQL/Redis 容器，验证事务和 Redis 降级。
- MQTT 测试用 EMQX 发布 JSON，验证数据库、Redis、WebSocket 三段数据流。
- 视频测试使用本地 FFmpeg 循环生成测试 RTSP，验证 WebRTC/HLS/FLV 播放适配和断流恢复。
- 前端使用 Playwright 验证管理员创建设备绑定，护士只能看到授权病区。
- 部署验收验证 Nginx 路由、JWT 拒绝无权限请求、摄像头凭证不出现在浏览器网络响应。

## 15. 交付拆分

### 里程碑 A：业务骨架与护士工作台

- 将现有前端品牌改为“医用智能毯安全监护平台”。
- 建立医院、病区、病房、床位、设备成组绑定的前端页面与 Mock 数据。
- 完成单路摄像头播放器、滚动回放时间线和告警时间线。
- 完成护士按病区查看床位与视频详情的交互。

### 里程碑 B：Java 主控与数据库

- 建立 Spring Boot 3 / JDK 17 工程。
- 实现 JWT 登录、角色与病区授权。
- 实现床位、设备、绑定、最近读数和历史读数 API。
- 将前端登录和设备数据切换到 Java API。

### 里程碑 C：传感器实时链路

- 部署 EMQX。
- 实现 MQTT 订阅、幂等校验、Redis 最新值和 MySQL 历史写入。
- 实现 WebSocket 实时推送。

### 里程碑 D：摄像头与流媒体

- 部署 MediaMTX。
- 根据摄像头可达后的实际协议录入 RTSP/RTMP/SRT 来源。
- 实现 WebRTC、HLS、FLV 多协议播放和 Nginx `/live` 代理。
- 增加媒体断流、重连和线路自动降级。
- 配置滚动录像保留；告警消息触发告警前 30 秒至后 60 秒的片段保存。

### 里程碑 E：生产加固

- 公开 API、API key、限流和撤销。
- Redis、MySQL、EMQX 和 MediaMTX 监控。
- 备份、审计、HTTPS 和最小权限网络策略。

## 16. 当前外部约束

摄像头 Jetson Nano 地址已在 2026-11-04 恢复正常访问，并通过 NetworkManager 固定为 `10.208.236.131/24`，网关和 DNS 为 `10.208.236.219`。

当前摄像头为 CSI IMX219：

- 使用 `nvarguscamerasrc` 采集。
- 使用 `nvv4l2h264enc` 进行硬件编码。
- 以 1280×720、30fps 推送到本机 MediaMTX。
- WebRTC 地址：`http://10.208.236.131:8889/camera-01/whep`
- HLS 地址：`http://10.208.236.131:8888/camera-01/index.m3u8`
- RTSP 地址：`rtsp://10.208.236.131:8554/camera-01`

MediaMTX 和摄像头推流均由 service/container 自动启动；录像按 1 小时分段，服务器滚动保留 24 小时。应用服务器 `192.168.86.128` 当前不能直接路由到摄像头网段，因此浏览器需要具备到 `10.208.236.0/24` 的网络访问能力。

## 17. 已确认决策

- 平台名称使用“医用智能毯安全监护平台”。
- 业务绑定粒度使用床位。
- 初始数据只有一路摄像头，不虚构侧视角；新增设备后才显示对应画面。
- 摄像头数量由数据决定；开发者可以持续新增摄像头，监控页按实际数量自适应展示。
- 一个毯子传感器与摄像头按床位成组绑定。
- 当前传感器没有温度、压力或电量指标，页面只显示传感器设备图形。
- 传感器图形帧率可填写，范围为 0.1–10 帧/秒，并提供 1、2、5、10 帧/秒快捷选项。
- 护士可以新增床位，并维护授权病区内的患者信息和患者状态。
- 医院管理员维护病区、病房、床位、患者资料、人员和告警录像策略，不修改设备绑定。
- 只有开发者可以修改摄像头与传感器绑定、设备档案和 MQTT 技术配置。
- 开发者可以额外查看 Broker 账户密码、原始 MQTT 报文、服务状态和接口密钥。
- 护士权限按病区分配。
- 摄像头接入使用标准协议适配层，不依赖特定厂商页面。
- 前端播放协议优先 WebRTC，其次 HLS，最后 HTTP-FLV。
- MQTT 告警主题记录事件内容、发生时间和对应摄像头，并触发录像片段保存。
- 未解决告警显示红色，标记解决后显示绿色和解决时间。
- 录像时间轴滚动前进，超出服务端保留期的片段从查询结果和界面中消失。
- 第一阶段先建立通用业务骨架，待摄像头网络可达后录入真实媒体参数。
