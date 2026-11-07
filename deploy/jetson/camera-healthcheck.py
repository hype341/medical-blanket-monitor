#!/usr/bin/env python3

import json
import subprocess
import sys


def main():
    media_path = sys.argv[1] if len(sys.argv) > 1 else "camera-01"
    source = f"rtsp://127.0.0.1:8554/{media_path}"
    command = [
        "timeout",
        "15",
        "ffprobe",
        "-v",
        "error",
        "-rtsp_transport",
        "tcp",
        "-select_streams",
        "v:0",
        "-read_intervals",
        "%+2",
        "-show_entries",
        "stream=codec_name,width,height",
        "-of",
        "json",
        source,
    ]
    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        timeout=20,
        check=False,
    )
    if result.returncode != 0:
        details = result.stderr.strip() or f"ffprobe exited with {result.returncode}"
        raise RuntimeError(details)

    streams = json.loads(result.stdout or "{}").get("streams", [])
    video = next((stream for stream in streams if stream.get("codec_name")), None)
    if not video:
        raise RuntimeError("RTSP stream has no video track")
    width = video.get("width", 0)
    height = video.get("height", 0)
    if width <= 0 or height <= 0:
        raise RuntimeError("RTSP video track has invalid dimensions")
    print(
        f"camera healthcheck passed: {media_path}, "
        f"{video['codec_name']} {width}x{height}"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"camera healthcheck failed: {error}", file=sys.stderr)
        raise SystemExit(1)
