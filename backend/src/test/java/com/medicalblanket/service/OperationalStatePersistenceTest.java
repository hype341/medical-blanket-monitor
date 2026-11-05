package com.medicalblanket.service;

import com.medicalblanket.processing.SensorProcessingService;
import com.medicalblanket.websocket.AlarmWebSocketHandler;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OperationalStatePersistenceTest {
    @TempDir
    Path stateDirectory;

    @Test
    void restoresAlarmsAfterServiceRecreation() {
        ObjectMapper objectMapper = new ObjectMapper();
        StateFileRepository repository = new StateFileRepository(
                objectMapper,
                stateDirectory.toString()
        );
        AlarmStore first = new AlarmStore(
                objectMapper,
                new AlarmWebSocketHandler(objectMapper),
                repository
        );
        ObjectNode alarm = objectMapper.createObjectNode();
        alarm.put("alarmId", "alarm-restart-01");
        alarm.put("bedId", "bed-a-01");
        alarm.put("title", "服务重启测试告警");
        alarm.put("status", "OPEN");
        first.accept(alarm);

        AlarmStore restored = new AlarmStore(
                objectMapper,
                new AlarmWebSocketHandler(objectMapper),
                repository
        );
        restored.restore();

        assertThat(restored.list("bed-a-01")).hasSize(1);
        assertThat(restored.list("bed-a-01").get(0).path("title").asText())
                .isEqualTo("服务重启测试告警");
        assertThat(restored.openCount()).isEqualTo(1);
    }

    @Test
    void restoresLatestAndProcessedSensorState() {
        ObjectMapper objectMapper = new ObjectMapper();
        StateFileRepository repository = new StateFileRepository(
                objectMapper,
                stateDirectory.toString()
        );
        SensorProcessingService processing = new SensorProcessingService(objectMapper, List.of());
        SensorStore first = new SensorStore(objectMapper, processing, repository);
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("bedId", "bed-a-01");
        payload.put("data", "ffaa");
        first.accept("medical-blanket/v1/H001/WARD-A/301-01/sensor/blanket-001/data", payload);
        first.flushIfDirty();

        SensorStore restored = new SensorStore(objectMapper, processing, repository);
        restored.restore();

        assertThat(restored.latest("bed-a-01")).isPresent();
        assertThat(restored.latest("bed-a-01").orElseThrow().path("data").asText())
                .isEqualTo("ff,aa");
        assertThat(restored.processed("bed-a-01")).isPresent();
    }
}
