package com.medicalblanket.processing;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SensorProcessingServiceTest {
    @Test
    void runsRegisteredProcessorsWithoutChangingTheRawPayload() {
        ObjectMapper objectMapper = new ObjectMapper();
        SensorProcessingService service = new SensorProcessingService(
                objectMapper,
                List.of(new SensorPayloadProcessor() {
                    @Override
                    public String id() {
                        return "sample";
                    }

                    @Override
                    public tools.jackson.databind.node.ObjectNode process(
                            String bedId,
                            tools.jackson.databind.node.ObjectNode payload
                    ) {
                        return objectMapper.createObjectNode()
                                .put("bedId", bedId)
                                .put("display", "processed");
                    }
                })
        );

        var result = service.process("bed-a-01", objectMapper.createObjectNode().put("data", "ff,aa"));

        assertThat(result.path("sample").path("display").asText()).isEqualTo("processed");
    }
}
