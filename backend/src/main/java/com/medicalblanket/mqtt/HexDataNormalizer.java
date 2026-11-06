package com.medicalblanket.mqtt;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

import java.util.Locale;
import java.util.StringJoiner;

public final class HexDataNormalizer {
    private HexDataNormalizer() {}

    public static String normalize(String value) {
        if (value == null) return "";
        String compact = value.replaceAll("(?i)0x", "").replaceAll("[\\s,;:|_-]+", "");
        if (compact.isEmpty() || compact.length() % 2 != 0 || !compact.matches("(?i)[0-9a-f]+")) {
            return value.trim();
        }
        return String.join(",", compact.toLowerCase(Locale.ROOT).split("(?<=\\G.{2})"));
    }

    public static ObjectNode normalizeSensor(ObjectNode payload) {
        JsonNode data = payload.get("data");
        if (data != null && data.isTextual()) {
            payload.set("data", StringNode.valueOf(normalize(data.asText())));
        }
        if ((data == null || data.asText("").isBlank()) && payload.path("metrics").isObject()) {
            JsonNode metrics = payload.path("metrics");
            JsonNode rawFrame = metrics.get("rawFrame");
            if (rawFrame != null && rawFrame.isArray()) {
                int start = rawFrame.size() >= 1799 ? 6 : rawFrame.size() >= 1798 ? 5 : 0;
                String hex = hexBytes(rawFrame, start, Math.min(start + 1792, rawFrame.size()));
                if (!hex.isEmpty()) payload.put("data", hex);
            } else {
                JsonNode bytes = metrics.has("pressure") ? metrics.get("pressure") : metrics.get("raw");
                if (bytes != null && bytes.isArray()) {
                    String hex = hexBytes(bytes, 0, bytes.size());
                    if (!hex.isEmpty()) payload.put("data", hex);
                }
            }
        }
        return payload;
    }

    public static String rawHex(JsonNode payload) {
        JsonNode metrics = payload.path("metrics");
        JsonNode rawFrame = metrics.has("rawFrame")
                ? metrics.get("rawFrame")
                : metrics.has("pressure")
                ? metrics.get("pressure")
                : metrics.get("raw");
        if (rawFrame != null && rawFrame.isArray()) {
            return hexBytes(rawFrame, 0, rawFrame.size());
        }
        return payload.path("data").asText("");
    }

    private static String hexBytes(JsonNode bytes, int start, int end) {
        StringJoiner hex = new StringJoiner(",");
        for (int index = start; index < end; index += 1) {
            JsonNode value = bytes.get(index);
            if (!value.isIntegralNumber()) continue;
            hex.add(String.format("%02x", value.asInt() & 0xff));
        }
        return hex.toString();
    }
}
