package com.medicalblanket.processing;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SensorProcessingService {
    private final ObjectMapper objectMapper;
    private final List<SensorPayloadProcessor> processors;

    public SensorProcessingService(ObjectMapper objectMapper, List<SensorPayloadProcessor> processors) {
        this.objectMapper = objectMapper;
        this.processors = processors;
    }

    public ObjectNode process(String bedId, ObjectNode payload) {
        ObjectNode result = objectMapper.createObjectNode();
        for (SensorPayloadProcessor processor : processors) {
            try {
                result.set(processor.id(), processor.process(bedId, payload.deepCopy()));
            } catch (RuntimeException error) {
                ObjectNode failed = objectMapper.createObjectNode();
                failed.put("error", error.getMessage());
                result.set(processor.id(), failed);
            }
        }
        return result;
    }
}
