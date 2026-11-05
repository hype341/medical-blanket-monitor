#!/usr/bin/env python3
"""Publish retained server time and expose it as a small HTTP JSON file."""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


MQTT_HOST = os.environ.get("MQTT_HOST", "127.0.0.1")
MQTT_PORT = os.environ.get("MQTT_PORT", "1883")
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "blanket-publisher")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "")
MQTT_TOPIC = os.environ.get("MQTT_TIME_TOPIC", "medical-blanket/v1/system/time")
OUTPUT_FILE = Path(os.environ.get("SYSTEM_TIME_FILE", "/var/www/blanket-system/time.json"))
INTERVAL_SECONDS = max(
    1,
    int(os.environ.get("SYSTEM_TIME_INTERVAL_SECONDS", "5")),
)
TIMEZONE = ZoneInfo(os.environ.get("SYSTEM_TIMEZONE", "Asia/Shanghai"))

running = True


def stop_service(_signum: int, _frame: object) -> None:
    global running
    running = False


def atomic_write(value: dict[str, object]) -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT_FILE.with_name(f".{OUTPUT_FILE.name}.{os.getpid()}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    os.replace(temporary, OUTPUT_FILE)


def publish(payload: str) -> None:
    result = subprocess.run(
        [
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
            MQTT_TOPIC,
            "-q",
            "1",
            "-r",
            "-m",
            payload,
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr.strip() or "Failed to publish server time", file=sys.stderr, flush=True)


def main() -> int:
    if not MQTT_PASSWORD:
        print("MQTT_PASSWORD is required", file=sys.stderr, flush=True)
        return 1

    signal.signal(signal.SIGTERM, stop_service)
    signal.signal(signal.SIGINT, stop_service)

    while running:
        now = datetime.now(TIMEZONE)
        message = {
            "unix": int(now.timestamp()),
            "iso": now.isoformat(timespec="seconds"),
        }
        serialized = json.dumps(message, ensure_ascii=False, separators=(",", ":"))
        atomic_write(message)
        publish(serialized)
        for _ in range(INTERVAL_SECONDS):
            if not running:
                break
            time.sleep(1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
