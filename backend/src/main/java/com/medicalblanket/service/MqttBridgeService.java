package com.medicalblanket.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import com.medicalblanket.config.MqttProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class MqttBridgeService {
    private static final Logger log = LoggerFactory.getLogger(MqttBridgeService.class);
    private final MqttProperties properties;
    private final ObjectMapper objectMapper;
    private final SensorStore sensorStore;
    private final AlarmStore alarmStore;
    private MqttClient observer;
    private MqttClient alarmObserver;
    private MqttClient publisher;
    private volatile boolean connected;

    public MqttBridgeService(
            MqttProperties properties,
            ObjectMapper objectMapper,
            SensorStore sensorStore,
            AlarmStore alarmStore
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.sensorStore = sensorStore;
        this.alarmStore = alarmStore;
    }

    @PostConstruct
    public void start() {
        if (!properties.isEnabled()) return;
        try {
            observer = connect(
                    properties.getObserverClientId(),
                    properties.getObserverUsername(),
                    properties.getObserverPassword(),
                    false
            );
            observer.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {
                    connected = false;
                    log.warn("MQTT observer connection lost", cause);
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    try {
                        JsonNode parsed = objectMapper.readTree(message.getPayload());
                        if (!(parsed instanceof ObjectNode payload)) return;
                        sensorStore.accept(topic, payload);
                    } catch (Exception error) {
                        log.debug("Ignoring invalid MQTT payload on {}", topic, error);
                    }
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {}
            });
            observer.subscribe(properties.getDataTopic(), 1);
            alarmObserver = connect(
                    properties.getAlarmObserverClientId(),
                    properties.getObserverUsername(),
                    properties.getObserverPassword(),
                    true
            );
            alarmObserver.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {
                    connected = false;
                    log.warn("MQTT alarm observer connection lost", cause);
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    try {
                        JsonNode parsed = objectMapper.readTree(message.getPayload());
                        if (parsed instanceof ObjectNode payload) alarmStore.accept(payload);
                    } catch (Exception error) {
                        log.debug("Ignoring invalid MQTT alarm payload on {}", topic, error);
                    }
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {}
            });
            alarmObserver.subscribe(properties.getAlarmTopic(), 1);
            publisher = connect(
                    properties.getPublisherClientId(),
                    properties.getPublisherUsername(),
                    properties.getPublisherPassword(),
                    false
            );
            connected = true;
            log.info("Spring MQTT bridge connected to {}", properties.getUrl());
        } catch (Exception error) {
            log.error("Spring MQTT bridge could not connect", error);
        }
    }

    public boolean isConnected() {
        return connected
                && observer != null && observer.isConnected()
                && alarmObserver != null && alarmObserver.isConnected()
                && publisher != null && publisher.isConnected();
    }

    public void publishAlarm(String topic, ObjectNode notification) throws Exception {
        if (publisher == null || !publisher.isConnected()) {
            throw new IllegalStateException("MQTT publisher is not connected");
        }
        MqttMessage message = new MqttMessage(objectMapper.writeValueAsBytes(notification));
        message.setQos(1);
        publisher.publish(topic, message);
        alarmStore.accept(notification);
    }

    @PreDestroy
    public void stop() {
        connected = false;
        close(observer);
        close(alarmObserver);
        close(publisher);
    }

    private MqttClient connect(
            String clientId,
            String username,
            String password,
            boolean persistentSession
    ) throws Exception {
        MqttClient client = new MqttClient(properties.getUrl(), clientId, new MemoryPersistence());
        MqttConnectOptions options = new MqttConnectOptions();
        options.setAutomaticReconnect(true);
        options.setCleanSession(!persistentSession);
        options.setConnectionTimeout(10);
        options.setKeepAliveInterval(30);
        if (persistentSession) options.setMaxInflight(1_000);
        if (username != null && !username.isBlank()) options.setUserName(username);
        if (password != null && !password.isBlank()) options.setPassword(password.toCharArray());
        client.connect(options);
        return client;
    }

    private void close(MqttClient client) {
        if (client == null) return;
        try {
            if (client.isConnected()) client.disconnect();
            client.close();
        } catch (Exception error) {
            log.debug("Could not close MQTT client", error);
        }
    }
}
