package com.medicalblanket.service;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.URI;
import java.net.Socket;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class MediaHealthService {
    public record ProbeRequest(String cameraId, String baseUrl, String path) {}

    public record ProbeResult(
            String cameraId,
            String status,
            int latencyMs,
            String detail,
            String checkedAt
    ) {}

    private record CachedResult(ProbeResult result, Instant expiresAt) {}

    private final long timeoutMs;
    private final long cacheTtlMs;
    private final Set<String> allowedBaseUrls;
    private final ConcurrentHashMap<String, CachedResult> cache = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newFixedThreadPool(8);
    private final java.util.regex.Pattern safePath =
            java.util.regex.Pattern.compile("^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$");

    public MediaHealthService(
            @Value("${blanket.media.timeout-ms:2500}") long timeoutMs,
            @Value("${blanket.media.cache-ttl-ms:15000}") long cacheTtlMs,
            @Value("${blanket.media.allowed-base-urls:http://10.208.236.131:8888}") String allowedBaseUrls
    ) {
        this.timeoutMs = Math.max(500, timeoutMs);
        this.cacheTtlMs = Math.max(1_000, cacheTtlMs);
        this.allowedBaseUrls = Arrays.stream(allowedBaseUrls.split(","))
                .map(String::trim)
                .map(this::normalizeBaseUrl)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toUnmodifiableSet());
    }

    public List<ProbeResult> probeBatch(List<ProbeRequest> requests) {
        if (requests == null || requests.isEmpty()) return List.of();
        if (requests.size() > 100) {
            throw new IllegalArgumentException("一次最多检查 100 个摄像头");
        }

        List<Future<ProbeResult>> futures = new ArrayList<>(requests.size());
        for (ProbeRequest request : requests) {
            futures.add(executor.submit(() -> probe(request)));
        }
        List<ProbeResult> results = new ArrayList<>(requests.size());
        for (Future<ProbeResult> future : futures) {
            try {
                results.add(future.get(timeoutMs + 1_000, TimeUnit.MILLISECONDS));
            } catch (Exception error) {
                results.add(new ProbeResult("", "OFFLINE", 0, "状态检查超时", Instant.now().toString()));
            }
        }
        return results;
    }

    private ProbeResult probe(ProbeRequest request) {
        String cameraId = request == null ? "" : safe(request.cameraId());
        String baseUrl = normalizeBaseUrl(request == null ? "" : request.baseUrl());
        String path = safe(request == null ? "" : request.path());
        if (cameraId.isBlank() || path.isBlank() || !safePath.matcher(path).matches()) {
            return new ProbeResult(cameraId, "OFFLINE", 0, "摄像头参数无效", Instant.now().toString());
        }
        if (!allowedBaseUrls.contains(baseUrl)) {
            return new ProbeResult(cameraId, "OFFLINE", 0, "流媒体节点未加入允许列表", Instant.now().toString());
        }

        String cacheKey = baseUrl + "|" + path;
        CachedResult cached = cache.get(cacheKey);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.result();
        }

        long startedAt = System.nanoTime();
        try {
            URI uri = URI.create(baseUrl + "/" + path + "/index.m3u8?cookieCheck=1");
            int statusCode = requestStatus(uri);
            int latency = elapsedMillis(startedAt);
            boolean online = statusCode >= 200 && statusCode < 400;
            ProbeResult result = new ProbeResult(
                    cameraId,
                    online ? "ONLINE" : "OFFLINE",
                    latency,
                    online ? "HLS 流可用" : "HLS 返回 HTTP " + statusCode,
                    Instant.now().toString()
            );
            cache.put(cacheKey, new CachedResult(result, Instant.now().plusMillis(cacheTtlMs)));
            return result;
        } catch (Exception error) {
            ProbeResult result = new ProbeResult(
                    cameraId,
                    "OFFLINE",
                    elapsedMillis(startedAt),
                    error.getClass().getSimpleName() + "：流媒体节点不可达",
                    Instant.now().toString()
            );
            cache.put(cacheKey, new CachedResult(result, Instant.now().plusMillis(cacheTtlMs)));
            return result;
        }
    }

    private int requestStatus(URI uri) throws Exception {
        String scheme = uri.getScheme() == null ? "http" : uri.getScheme().toLowerCase();
        String host = uri.getHost();
        int port = uri.getPort() > 0 ? uri.getPort() : ("https".equals(scheme) ? 443 : 80);
        if (host == null) throw new IllegalArgumentException("媒体节点地址无效");

        Socket socket = new Socket();
        try {
            socket.connect(new InetSocketAddress(host, port), (int) timeoutMs);
            socket.setSoTimeout((int) timeoutMs);
            if ("https".equals(scheme)) {
                SSLSocket sslSocket = (SSLSocket) ((SSLSocketFactory) SSLSocketFactory.getDefault())
                        .createSocket(socket, host, port, true);
                sslSocket.startHandshake();
                socket = sslSocket;
            }
            String path = uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
            BufferedWriter writer = new BufferedWriter(
                    new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.US_ASCII)
            );
            writer.write("GET " + path + " HTTP/1.1\r\n");
            writer.write("Host: " + uri.getHost() + ":" + port + "\r\n");
            writer.write("Connection: close\r\n");
            writer.write("Cache-Control: no-cache\r\n\r\n");
            writer.flush();

            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII)
            );
            String statusLine = reader.readLine();
            if (statusLine == null) throw new IllegalStateException("媒体节点未返回状态");
            String[] parts = statusLine.split(" ");
            if (parts.length < 2) throw new IllegalStateException("媒体节点状态格式无效");
            return Integer.parseInt(parts[1]);
        } finally {
            socket.close();
        }
    }

    private int elapsedMillis(long startedAt) {
        return (int) Math.min(Integer.MAX_VALUE, TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt));
    }

    private String normalizeBaseUrl(String value) {
        if (value == null) return "";
        return value.trim().replaceAll("/+$", "");
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdownNow();
    }
}
