package com.medicalblanket.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import com.medicalblanket.websocket.AlarmWebSocketHandler;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
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

    public AlarmStore(ObjectMapper objectMapper, AlarmWebSocketHandler socketHandler) {
        this.objectMapper = objectMapper;
        this.socketHandler = socketHandler;
    }

    public void accept(JsonNode input) {
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
            socketHandler.broadcast(payload);
        }
        while (order.size() > 250) alarms.remove(order.remove(0));
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
}
