package com.medicalblanket.mqtt;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import static org.assertj.core.api.Assertions.assertThat;

class HexDataNormalizerTest {
    @Test
    void normalizesOnlyTheDataValueToCommaSeparatedHex() {
        assertThat(HexDataNormalizer.normalize("0xFF 0xAA")).isEqualTo("ff,aa");
        assertThat(HexDataNormalizer.normalize("ff,aa")).isEqualTo("ff,aa");
        assertThat(HexDataNormalizer.normalize("not-hex")).isEqualTo("not-hex");
    }

    @Test
    void derivesHexDataFromPressureBytesWhileKeepingMetrics() {
        ObjectMapper objectMapper = new ObjectMapper();
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("bedId", "bed-a-01");
        var metrics = payload.putObject("metrics");
        var pressure = metrics.putArray("pressure");
        pressure.add(255);
        pressure.add(170);
        pressure.add(0);

        ObjectNode normalized = HexDataNormalizer.normalizeSensor(payload);

        assertThat(normalized.path("data").asText()).isEqualTo("ff,aa,00");
        assertThat(normalized.path("metrics").path("pressure")).hasSize(3);
    }

    @Test
    void derivesHexDataFromTheEsp32RawFrame() {
        ObjectMapper objectMapper = new ObjectMapper();
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("bedId", "bed-a-01");
        var rawFrame = payload.putObject("metrics").putArray("rawFrame");
        rawFrame.add(255);
        rawFrame.add(170);
        rawFrame.add(7);

        assertThat(HexDataNormalizer.normalizeSensor(payload).path("data").asText())
                .isEqualTo("ff,aa,07");
    }

    @Test
    void extractsExactly1792BytesFromTheCompleteFrameAndKeepsRawFrame() {
        ObjectMapper objectMapper = new ObjectMapper();
        ObjectNode payload = objectMapper.createObjectNode();
        var rawFrame = payload.putObject("metrics").putArray("rawFrame");
        rawFrame.add(255);
        rawFrame.add(170);
        rawFrame.add(7);
        rawFrame.add(7);
        rawFrame.add(1);
        rawFrame.add(1);
        for (int index = 0; index < 1792; index += 1) rawFrame.add(index % 256);
        rawFrame.add(250);

        ObjectNode normalized = HexDataNormalizer.normalizeSensor(payload);

        assertThat(normalized.path("data").asText().split(",")).hasSize(1792);
        assertThat(normalized.path("data").asText()).startsWith("00,01,02");
        assertThat(normalized.path("metrics").path("rawFrame")).hasSize(1799);
        assertThat(HexDataNormalizer.rawHex(normalized).split(",")).hasSize(1799);
    }
}
