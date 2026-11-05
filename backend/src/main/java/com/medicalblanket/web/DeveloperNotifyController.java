package com.medicalblanket.web;

import tools.jackson.databind.node.ObjectNode;
import com.medicalblanket.service.MqttBridgeService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/developer")
public class DeveloperNotifyController {
    private static final Pattern ALARM_TOPIC = Pattern.compile(
            "^medical-blanket/v1/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/alarm$"
    );
    private final MqttBridgeService mqttBridge;

    public DeveloperNotifyController(MqttBridgeService mqttBridge) {
        this.mqttBridge = mqttBridge;
    }

    @PostMapping("/notify")
    public ResponseEntity<?> notifyDevice(@Valid @RequestBody NotifyRequest request) throws Exception {
        if (!ALARM_TOPIC.matcher(request.topic()).matches()) {
            return ResponseEntity.badRequest().body(Map.of("error", "告警主题无效"));
        }
        if (!"notification".equals(request.notification().path("type").asText())) {
            return ResponseEntity.badRequest().body(Map.of("error", "通知类型必须是 notification"));
        }
        if (request.notification().path("bedId").asText("").isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "床位标识不能为空"));
        }
        mqttBridge.publishAlarm(request.topic(), request.notification());
        return ResponseEntity.ok(Map.of("ok", true));
    }

    public record NotifyRequest(@NotBlank String topic, @NotNull ObjectNode notification) {}
}
