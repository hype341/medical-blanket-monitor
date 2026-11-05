package com.medicalblanket.websocket;

import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AlarmWebSocketHandler extends TextWebSocketHandler {
    private static final Logger log = LoggerFactory.getLogger(AlarmWebSocketHandler.class);
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private final ObjectMapper objectMapper;

    public AlarmWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }

    public void broadcast(Object payload) {
        try {
            TextMessage message = new TextMessage(objectMapper.writeValueAsString(payload));
            sessions.removeIf(session -> {
                try {
                    if (!session.isOpen()) return true;
                    synchronized (session) {
                        session.sendMessage(message);
                    }
                    return false;
                } catch (Exception error) {
                    log.debug("WebSocket alarm delivery failed", error);
                    return true;
                }
            });
        } catch (Exception error) {
            log.warn("Could not serialize alarm event", error);
        }
    }
}
