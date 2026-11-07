export interface RuntimeMqttEndpoints {
  brokerUrl: string;
  websocketUrl: string;
}

export function getRuntimeMqttEndpoints(): RuntimeMqttEndpoints {
  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "127.0.0.1";
  const websocketProtocol =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss"
      : "ws";
  return {
    brokerUrl: `mqtt://${host}:1883`,
    websocketUrl: `${websocketProtocol}://${host}/mqtt`,
  };
}
