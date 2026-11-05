package com.medicalblanket.web;

import tools.jackson.databind.node.ObjectNode;
import com.medicalblanket.service.AlarmStore;
import com.medicalblanket.service.MqttBridgeService;
import com.medicalblanket.service.SensorStore;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class PublicApiController {
    private final SensorStore sensorStore;
    private final AlarmStore alarmStore;
    private final MqttBridgeService mqttBridge;

    public PublicApiController(SensorStore sensorStore, AlarmStore alarmStore, MqttBridgeService mqttBridge) {
        this.sensorStore = sensorStore;
        this.alarmStore = alarmStore;
        this.mqttBridge = mqttBridge;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "blanket-backend",
                "mqttConnected", mqttBridge.isConnected(),
                "time", currentTime()
        );
    }

    @GetMapping("/public/time")
    public Map<String, Object> time() {
        Instant now = Instant.now();
        return Map.of(
                "unix", now.getEpochSecond(),
                "iso", DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(now.atZone(ZoneId.of("Asia/Shanghai")))
        );
    }

    @GetMapping("/public/sensors")
    public ObjectNode sensors() {
        return sensorStore.snapshot();
    }

    @GetMapping("/public/sensors/{bedId}")
    public ResponseEntity<ObjectNode> sensor(@PathVariable String bedId) {
        return sensorStore.latest(bedId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/public/sensors/{bedId}/processed")
    public ResponseEntity<ObjectNode> processedSensor(@PathVariable String bedId) {
        return sensorStore.processed(bedId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/public/alarms")
    public List<ObjectNode> alarms(@RequestParam(required = false) String bedId) {
        return alarmStore.list(bedId);
    }

    private String currentTime() {
        return DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(Instant.now().atZone(ZoneId.of("Asia/Shanghai")));
    }
}
