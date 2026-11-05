#!/usr/bin/env python3
"""Publish developer alarm notifications through the private MQTT account."""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


LISTEN_HOST = os.environ.get("ALARM_NOTIFY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("ALARM_NOTIFY_PORT", "8091"))
MQTT_HOST = os.environ.get("MQTT_HOST", "127.0.0.1")
MQTT_PORT = os.environ.get("MQTT_PORT", "1883")
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "")
MAX_BODY_BYTES = 16_384
RATE_LIMIT = 20
RATE_WINDOW_SECONDS = 60

TOPIC_PATTERN = re.compile(
    r"^medical-blanket/v1/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/alarm$"
)
BED_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
LEVELS = {"INFO", "WARNING", "CRITICAL"}
request_times: dict[str, deque[float]] = defaultdict(deque)


def is_rate_limited(remote_address: str) -> bool:
    now = time.monotonic()
    history = request_times[remote_address]
    while history and now - history[0] > RATE_WINDOW_SECONDS:
        history.popleft()
    if len(history) >= RATE_LIMIT:
        return True
    history.append(now)
    return False


def publish(topic: str, notification: dict[str, Any]) -> None:
    command = [
        "/usr/bin/mosquitto_pub",
        "-h",
        MQTT_HOST,
        "-p",
        MQTT_PORT,
        "-u",
        MQTT_USERNAME,
        "-P",
        MQTT_PASSWORD,
        "-t",
        topic,
        "-q",
        "1",
        "-m",
        json.dumps(notification, ensure_ascii=False, separators=(",", ":")),
    ]
    subprocess.run(command, check=True, capture_output=True, text=True, timeout=8)


class AlarmNotifyHandler(BaseHTTPRequestHandler):
    server_version = "BlanketAlarmNotify/1.0"

    def do_POST(self) -> None:
        if self.path != "/notify":
            self.send_error(404)
            return
        if is_rate_limited(self.client_address[0]):
            self.send_json(429, {"error": "请求过于频繁，请稍后重试"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "请求长度无效"})
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(400, {"error": "请求内容为空或过大"})
            return

        try:
            body = json.loads(self.rfile.read(length))
            topic = str(body.get("topic", ""))
            notification = body.get("notification")
            self.validate(topic, notification)
            publish(topic, notification)
        except (json.JSONDecodeError, ValueError) as error:
            self.send_json(400, {"error": str(error)})
            return
        except (subprocess.SubprocessError, OSError):
            self.send_json(502, {"error": "MQTT 发布失败"})
            return
        self.send_json(200, {"ok": True})

    def validate(self, topic: str, notification: Any) -> None:
        if not TOPIC_PATTERN.fullmatch(topic):
            raise ValueError("告警主题无效")
        if not isinstance(notification, dict):
            raise ValueError("通知报文无效")
        if notification.get("type") != "notification":
            raise ValueError("通知类型必须是 notification")
        if notification.get("level") not in LEVELS:
            raise ValueError("通知级别无效")
        if not BED_ID_PATTERN.fullmatch(str(notification.get("bedId", ""))):
            raise ValueError("床位标识无效")
        if not str(notification.get("title", "")).strip():
            raise ValueError("通知内容不能为空")

    def send_json(self, status: int, value: dict[str, Any]) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"{self.client_address[0]} {format_string % args}", flush=True)


def main() -> None:
    if not MQTT_USERNAME or not MQTT_PASSWORD:
        raise SystemExit("MQTT_USERNAME and MQTT_PASSWORD are required")
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), AlarmNotifyHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
