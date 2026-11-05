package com.medicalblanket.web;

import tools.jackson.databind.node.ObjectNode;
import com.medicalblanket.service.AlarmStore;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/alarms")
public class AlarmController {
    private final AlarmStore alarmStore;

    public AlarmController(AlarmStore alarmStore) {
        this.alarmStore = alarmStore;
    }

    @PatchMapping("/{alarmId}/resolve")
    public ResponseEntity<?> resolve(@PathVariable String alarmId) {
        return alarmStore.resolve(alarmId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{alarmId}")
    public ResponseEntity<?> delete(@PathVariable String alarmId) {
        return alarmStore.delete(alarmId)
                ? ResponseEntity.ok(Map.of("deleted", true))
                : ResponseEntity.notFound().build();
    }
}
