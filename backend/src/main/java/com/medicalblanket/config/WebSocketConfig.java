package com.medicalblanket.config;

import com.medicalblanket.websocket.AlarmWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    private final AlarmWebSocketHandler alarmHandler;

    public WebSocketConfig(AlarmWebSocketHandler alarmHandler) {
        this.alarmHandler = alarmHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(alarmHandler, "/ws/alarms").setAllowedOriginPatterns("*");
    }
}
