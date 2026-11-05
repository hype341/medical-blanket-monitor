package com.medicalblanket.service;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import com.medicalblanket.mqtt.HexDataNormalizer;
import com.medicalblanket.processing.SensorProcessingService;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SensorStore {
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private final ConcurrentHashMap<String, ObjectNode> latest = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ObjectNode> processed = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final SensorProcessingService processingService;

    public SensorStore(ObjectMapper objectMapper, SensorProcessingService processingService) {
        this.objectMapper = objectMapper;
        this.processingService = processingService;
    }

    public void accept(String topic, ObjectNode payload) {
        String bedId = payload.path("bedId").asText("");
        if (bedId.isBlank()) bedId = bedIdFromTopic(topic);
        if (bedId.isBlank()) return;
        if (payload.path("observedAt").asText("").isBlank()) {
            payload.put("observedAt", OffsetDateTime.now(ZONE).format(FORMAT));
        }
        ObjectNode normalized = HexDataNormalizer.normalizeSensor(payload.deepCopy());
        latest.put(bedId, normalized);
        processed.put(bedId, processingService.process(bedId, normalized));
    }

    public Optional<ObjectNode> latest(String bedId) {
        ObjectNode payload = latest.get(bedId);
        return payload == null ? Optional.empty() : Optional.of(payload.deepCopy());
    }

    public ObjectNode snapshot() {
        ObjectNode result = objectMapper.createObjectNode();
        latest.forEach(result::set);
        return result;
    }

    public Optional<ObjectNode> processed(String bedId) {
        ObjectNode payload = processed.get(bedId);
        return payload == null ? Optional.empty() : Optional.of(payload.deepCopy());
    }

    private String bedIdFromTopic(String topic) {
        String[] parts = topic.split("/");
        return parts.length >= 6 ? parts[4] : "";
    }
}
