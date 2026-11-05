package com.medicalblanket.service;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import com.medicalblanket.mqtt.HexDataNormalizer;
import com.medicalblanket.processing.SensorProcessingService;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.PostConstruct;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class SensorStore {
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private final ConcurrentHashMap<String, ObjectNode> latest = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ObjectNode> processed = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final SensorProcessingService processingService;
    private final StateFileRepository stateRepository;
    private final AtomicBoolean dirty = new AtomicBoolean(false);

    public SensorStore(
            ObjectMapper objectMapper,
            SensorProcessingService processingService,
            StateFileRepository stateRepository
    ) {
        this.objectMapper = objectMapper;
        this.processingService = processingService;
        this.stateRepository = stateRepository;
    }

    @PostConstruct
    public void restore() {
        restoreValues("sensor-latest.json", latest);
        restoreValues("sensor-processed.json", processed);
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
        dirty.set(true);
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

    public int size() {
        return latest.size();
    }

    @Scheduled(fixedDelayString = "${blanket.persistence.sensor-flush-ms:5000}")
    public synchronized void flushIfDirty() {
        if (!dirty.compareAndSet(true, false)) return;
        persistValues("sensor-latest.json", latest);
        persistValues("sensor-processed.json", processed);
    }

    @PreDestroy
    public synchronized void flushBeforeShutdown() {
        dirty.set(true);
        flushIfDirty();
    }

    private String bedIdFromTopic(String topic) {
        String[] parts = topic.split("/");
        return parts.length >= 6 ? parts[4] : "";
    }

    private void restoreValues(String fileName, ConcurrentHashMap<String, ObjectNode> target) {
        stateRepository.read(fileName).ifPresent(root -> {
            if (!root.isArray()) return;
            for (JsonNode item : root) {
                if (!(item instanceof ObjectNode entry)) continue;
                String bedId = entry.path("bedId").asText("");
                JsonNode payload = entry.get("payload");
                if (!bedId.isBlank() && payload instanceof ObjectNode value) {
                    target.put(bedId, value.deepCopy());
                }
            }
        });
    }

    private void persistValues(String fileName, ConcurrentHashMap<String, ObjectNode> source) {
        ArrayNode root = objectMapper.createArrayNode();
        source.forEach((bedId, value) -> {
            ObjectNode entry = objectMapper.createObjectNode();
            entry.put("bedId", bedId);
            entry.set("payload", value.deepCopy());
            root.add(entry);
        });
        stateRepository.write(fileName, root);
    }
}
