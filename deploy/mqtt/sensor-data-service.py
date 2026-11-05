#!/usr/bin/env python3
"""Subscribe to bed sensor topics and expose their latest payloads as JSON files."""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


OUTPUT_DIR = Path(os.environ.get("SENSOR_DATA_DIR", "/var/www/blanket-sensor-data"))
MQTT_HOST = os.environ.get("MQTT_HOST", "127.0.0.1")
MQTT_PORT = os.environ.get("MQTT_PORT", "1883")
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "blanket-device")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "")
MQTT_TOPIC = os.environ.get(
    "MQTT_TOPIC",
    "medical-blanket/v1/+/+/+/sensor/+/data",
)
WRITE_INTERVAL_SECONDS = max(
    0.01,
    float(os.environ.get("SENSOR_WRITE_INTERVAL_MS", "100")) / 1000,
)
SENSOR_TIMEZONE = ZoneInfo(os.environ.get("SENSOR_TIMEZONE", "Asia/Shanghai"))

running = True
subscriber: subprocess.Popen[str] | None = None
pending_payloads: dict[str, dict[str, Any]] = {}
pending_lock = threading.Lock()


def stop_service(_signum: int, _frame: Any) -> None:
    global running
    running = False
    if subscriber and subscriber.poll() is None:
        subscriber.terminate()


def atomic_write_json(file_path: Path, value: dict[str, Any]) -> None:
    temporary = file_path.with_name(f".{file_path.name}.{os.getpid()}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
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

    bed_id = safe_key(str(payload.get("bedId", "")))
    if not bed_id:
        return

    observed_at = payload.get("observedAt")
    if not isinstance(observed_at, str) or not observed_at:
        payload["observedAt"] = datetime.now(SENSOR_TIMEZONE).isoformat(timespec="seconds")

    # Keep only the newest payload per bed; disk writes are rate-limited below.
    with pending_lock:
        pending_payloads[bed_id] = payload


def writer_loop() -> None:
    while running:
        time.sleep(WRITE_INTERVAL_SECONDS)
        with pending_lock:
            batch = pending_payloads.copy()
            pending_payloads.clear()
        for bed_id, payload in batch.items():
            atomic_write_json(OUTPUT_DIR / f"{bed_id}.json", payload)


def main() -> int:
    if not MQTT_PASSWORD:
        print("MQTT_PASSWORD is required", file=sys.stderr, flush=True)
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    signal.signal(signal.SIGTERM, stop_service)
    signal.signal(signal.SIGINT, stop_service)

    global subscriber
    writer = threading.Thread(target=writer_loop, daemon=True)
    writer.start()
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
