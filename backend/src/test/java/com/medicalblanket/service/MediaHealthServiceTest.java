package com.medicalblanket.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MediaHealthServiceTest {
    @Test
    void reportsOnlineForAnAllowedReachableCameraPathAndRejectsUnknownHosts() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/camera-01/index.m3u8", exchange -> {
            byte[] body = "#EXTM3U".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.createContext("/camera-cookie/index.m3u8", exchange -> {
            if (exchange.getRequestURI().getQuery() == null) {
                exchange.getResponseHeaders().add("Set-Cookie", "probe=ok; Path=/");
                exchange.getResponseHeaders().add("Location", "/camera-cookie/index.m3u8?cookieCheck=1");
                exchange.sendResponseHeaders(302, -1);
            } else {
                byte[] body = "#EXTM3U".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
            exchange.close();
        });
        server.start();
        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            MediaHealthService service = new MediaHealthService(1_000, 1_000, baseUrl);

            List<MediaHealthService.ProbeResult> results = service.probeBatch(List.of(
                    new MediaHealthService.ProbeRequest("camera-01", baseUrl, "camera-01"),
                    new MediaHealthService.ProbeRequest(
                            "camera-02",
                            "http://127.0.0.1:1",
                            "camera-02"
                    ),
                    new MediaHealthService.ProbeRequest("camera-cookie", baseUrl, "camera-cookie")
            ));

            assertThat(results.get(0).status()).isEqualTo("ONLINE");
            assertThat(results.get(1).status()).isEqualTo("OFFLINE");
            assertThat(results.get(1).detail()).contains("允许列表");
            assertThat(results.get(2).status()).isEqualTo("ONLINE");
        } finally {
            server.stop(0);
        }
    }
}
