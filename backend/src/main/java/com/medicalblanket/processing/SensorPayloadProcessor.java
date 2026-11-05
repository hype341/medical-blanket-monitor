package com.medicalblanket.processing;

import tools.jackson.databind.node.ObjectNode;

/**
 * Extension point for turning a raw blanket payload into business display data.
 * Implementations are discovered as Spring beans and run after each MQTT message.
 */
public interface SensorPayloadProcessor {
    String id();

    ObjectNode process(String bedId, ObjectNode normalizedPayload);
}
