package com.medicalblanket.mqtt;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

import java.util.Locale;

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
        return payload;
    }
}
