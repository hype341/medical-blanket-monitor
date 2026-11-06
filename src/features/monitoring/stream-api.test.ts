import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractSensorHexData,
  getSensorHex,
  getSensorRawHex,
} from "./stream-api";

describe("hexadecimal sensor interfaces", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns only the normalized hexadecimal payload from the HTTP interface", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("ff,aa", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSensorHex("bed-a-01")).resolves.toBe("ff,aa");
    expect(fetchMock).toHaveBeenCalledWith("/api/public/sensors/bed-a-01/hex", {
      cache: "no-store",
    });
  });

  it("extracts only the data field from a parsed sensor message", () => {
    expect(
      extractSensorHexData({
        messageId: "message-01",
        deviceKey: "blanket-001",
        bedId: "bed-a-01",
        observedAt: "2026-11-06T09:00:00+08:00",
        status: "ONLINE",
        data: "ff,aa",
        metrics: {},
      }),
    ).toBe("ff,aa");
  });

  it("returns the complete raw frame from the raw HTTP interface", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("ff,aa,07,07,01,01,fa", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSensorRawHex("bed-a-01")).resolves.toBe("ff,aa,07,07,01,01,fa");
    expect(fetchMock).toHaveBeenCalledWith("/api/public/sensors/bed-a-01/raw-hex", {
      cache: "no-store",
    });
  });
});
