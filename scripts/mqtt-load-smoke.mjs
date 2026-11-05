import mqtt from "mqtt";

const url = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;
const topic =
  process.env.MQTT_TOPIC ??
  "medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data";
const count = Number(process.env.MQTT_MESSAGES ?? "100");
const size = Number(process.env.MQTT_PAYLOAD_BYTES ?? "256");
const qos = Number(process.env.MQTT_QOS ?? "1");
const concurrency = Math.max(1, Number(process.env.MQTT_CONCURRENCY ?? "32"));

const payload = JSON.stringify({
  bedId: "bed-a-01",
  sensorKey: "blanket-001",
  data: "ffaa",
  padding: "x".repeat(Math.max(0, size - 64)),
});
const client = mqtt.connect(url, {
  username,
  password,
  clientId: `blanket-load-smoke-${Date.now()}`,
  reconnectPeriod: 0,
  connectTimeout: 10_000,
});
const startedAt = performance.now();

client.on("connect", async () => {
  try {
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < count) {
        nextIndex += 1;
        await client.publishAsync(topic, payload, { qos });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
    const duration = performance.now() - startedAt;
    const rate = Math.round((count / duration) * 1_000);
    console.log(
      JSON.stringify({
        url,
        topic,
        count,
        payloadBytes: Buffer.byteLength(payload),
        qos,
        concurrency,
        durationMs: Math.round(duration),
        messagesPerSecond: rate,
      }),
    );
    await client.endAsync();
  } catch (error) {
    console.error(error);
    client.end(true);
    process.exitCode = 1;
  }
});

client.on("error", (error) => {
  console.error(error);
  client.end(true);
  process.exitCode = 1;
});
