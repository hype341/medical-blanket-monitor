package com.medicalblanket.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import com.medicalblanket.websocket.AlarmWebSocketHandler;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class AlarmStore {
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private final ConcurrentHashMap<String, ObjectNode> alarms = new ConcurrentHashMap<>();
    private final CopyOnWriteArrayList<String> order = new CopyOnWriteArrayList<>();
    private final ObjectMapper objectMapper;
    private final AlarmWebSocketHandler socketHandler;
    private final StateFileRepository stateRepository;

    public AlarmStore(
            ObjectMapper objectMapper,
            AlarmWebSocketHandler socketHandler,
            StateFileRepository stateRepository
    ) {
        this.objectMapper = objectMapper;
        this.socketHandler = socketHandler;
        this.stateRepository = stateRepository;
    }

    @PostConstruct
    public synchronized void restore() {
        stateRepository.read("alarms.json").ifPresent(root -> {
            if (!root.isArray()) return;
            for (JsonNode item : root) {
                if (!(item instanceof ObjectNode alarm)) continue;
                String alarmId = alarm.path("alarmId").asText("");
                if (alarmId.isBlank() || alarms.containsKey(alarmId)) continue;
                alarms.put(alarmId, alarm.deepCopy());
                order.add(alarmId);
            }
            while (order.size() > 250) alarms.remove(order.remove(0));
        });
    }

    public synchronized void accept(JsonNode input) {
        if (!(input instanceof ObjectNode payload)) return;
        String alarmId = payload.path("alarmId").asText("");
        String bedId = payload.path("bedId").asText("");
        if (alarmId.isBlank() || bedId.isBlank()) return;
        if (payload.path("occurredAt").asText("").isBlank()) {
            payload.put("occurredAt", OffsetDateTime.now(ZONE).format(FORMAT));
        }
        if (payload.path("status").asText("").isBlank()) payload.put("status", "OPEN");
        boolean isNew = alarms.putIfAbsent(alarmId, payload.deepCopy()) == null;
        if (isNew) {
            order.add(alarmId);
            socketHandler.broadcast(event("alarm.created", payload));
        }
        while (order.size() > 250) alarms.remove(order.remove(0));
        persist();
    }

    public synchronized Optional<ObjectNode> resolve(String alarmId) {
        ObjectNode alarm = alarms.get(alarmId);
        if (alarm == null) return Optional.empty();
        alarm.put("status", "RESOLVED");
        alarm.put("resolvedAt", OffsetDateTime.now(ZONE).format(FORMAT));
        socketHandler.broadcast(event("alarm.updated", alarm));
        persist();
        return Optional.of(alarm.deepCopy());
    }

    public synchronized boolean delete(String alarmId) {
        ObjectNode removed = alarms.remove(alarmId);
        if (removed == null) return false;
        order.remove(alarmId);
        ObjectNode event = objectMapper.createObjectNode();
        event.put("event", "alarm.deleted");
        event.put("alarmId", alarmId);
        socketHandler.broadcast(event);
        persist();
        return true;
    }

    public List<ObjectNode> list(String bedId) {
        return java.util.stream.IntStream.range(0, order.size())
                .map(i -> order.size() - i - 1)
                .mapToObj(order::get)
                .map(alarms::get)
                .filter(value -> value != null && (bedId == null || bedId.equals(value.path("bedId").asText())))
                .map(ObjectNode::deepCopy)
                .toList();
    }

    public ObjectNode envelope(ObjectNode alarm) {
        return alarm;
    }

    public int size() {
        return alarms.size();
    }

    public long openCount() {
        return alarms.values().stream()
                .filter(alarm -> "OPEN".equals(alarm.path("status").asText("OPEN")))
                .count();
    }

    private void persist() {
        ArrayNode root = objectMapper.createArrayNode();
        for (String alarmId : order) {
            ObjectNode alarm = alarms.get(alarmId);
            if (alarm != null) root.add(alarm.deepCopy());
        }
        stateRepository.write("alarms.json", root);
    }

    private ObjectNode event(String name, ObjectNode alarm) {
        ObjectNode event = objectMapper.createObjectNode();
        event.put("event", name);
        event.set("alarm", alarm.deepCopy());
        return event;
    }
}
