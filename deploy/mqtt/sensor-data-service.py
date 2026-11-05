#!/usr/bin/env python3
"""Subscribe to bed sensor topics and expose their latest payloads as JSON files."""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


OUTPUT_DIR = Path(os.environ.get("SENSOR_DATA_DIR", "/var/www/blanket-sensor-data"))
MQTT_HOST = os.environ.get("MQTT_HOST", "127.0.0.1")
MQTT_PORT = os.environ.get("MQTT_PORT", "1883")
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "blanket-device")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "")
MQTT_TOPIC = os.environ.get(
    "MQTT_TOPIC",
    "medical-blanket/v1/+/+/+/sensor/+/data",
)

running = True
subscriber: subprocess.Popen[str] | None = None


def stop_service(_signum: int, _frame: Any) -> None:
    global running
    running = False
    if subscriber and subscriber.poll() is None:
        subscriber.terminate()


def atomic_write_json(file_path: Path, value: dict[str, Any]) -> None:
    temporary = file_path.with_name(f".{file_path.name}.{os.getpid()}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(temporary, file_path)


def safe_key(value: str) -> str | None:
    normalized = value.strip().replace("/", "-")
    if not normalized or any(character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for character in normalized):
        return None
    return normalized


def process_message(topic: str, payload_text: str) -> None:
    parts = topic.split("/")
    if len(parts) < 8 or parts[-1] != "data":
        return

    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError:
        return
    if not isinstance(payload, dict):
        return

    envelope = {
        **payload,
        "sourceTopic": topic,
        "bedCode": parts[4],
        "deviceKey": payload.get("deviceKey") or parts[-2],
        "receivedAt": datetime.now(timezone.utc).astimezone().isoformat(),
    }
    keys = {
        safe_key(str(envelope.get("bedId", ""))),
        safe_key(str(envelope.get("bedCode", ""))),
        safe_key(str(envelope.get("deviceKey", ""))),
    }

    index_path = OUTPUT_DIR / "index.json"
    try:
        index = json.loads(index_path.read_text(encoding="utf-8"))
        if not isinstance(index, dict):
            index = {}
    except (FileNotFoundError, json.JSONDecodeError):
        index = {}

    for key in keys:
        if key:
            atomic_write_json(OUTPUT_DIR / f"{key}.json", envelope)
            index[key] = {
                "url": f"/api/public/sensors/{key}",
                "updatedAt": envelope["receivedAt"],
            }

    atomic_write_json(index_path, index)


def main() -> int:
    if not MQTT_PASSWORD:
        print("MQTT_PASSWORD is required", file=sys.stderr, flush=True)
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    signal.signal(signal.SIGTERM, stop_service)
    signal.signal(signal.SIGINT, stop_service)

    global subscriber
    subscriber = subprocess.Popen(
        [
            "/usr/bin/mosquitto_sub",
            "-h",
            MQTT_HOST,
            "-p",
            MQTT_PORT,
            "-u",
            MQTT_USERNAME,
            "-P",
            MQTT_PASSWORD,
            "-t",
            MQTT_TOPIC,
            "-v",
        ],
        stdout=subprocess.PIPE,
        stderr=sys.stderr,
        text=True,
        bufsize=1,
    )

    assert subscriber.stdout is not None
    while running:
        line = subscriber.stdout.readline()
        if not line:
            break
        topic, separator, payload = line.rstrip("\n").partition(" ")
        if separator:
            process_message(topic, payload)

    return subscriber.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
