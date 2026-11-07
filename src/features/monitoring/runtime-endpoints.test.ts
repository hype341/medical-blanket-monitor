import { afterEach, describe, expect, it, vi } from "vitest";
import { getRuntimeMqttEndpoints } from "./runtime-endpoints";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runtime server endpoints", () => {
  it("uses the current HTTP server address for MQTT", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "172.20.10.12",
        protocol: "http:",
      },
    });

    expect(getRuntimeMqttEndpoints()).toEqual({
      brokerUrl: "mqtt://172.20.10.12:1883",
      websocketUrl: "ws://172.20.10.12:8083/mqtt",
    });
  });

  it("uses secure WebSockets when the website is served over HTTPS", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "monitor.example.com",
        protocol: "https:",
      },
    });

    expect(getRuntimeMqttEndpoints().websocketUrl).toBe(
      "wss://monitor.example.com/mqtt",
    );
  });
});
