#!/usr/bin/env bash
set -euo pipefail

exec gst-launch-1.0 -e \
  nvarguscamerasrc sensor-id=0 \
  ! "video/x-raw(memory:NVMM),width=1280,height=720,framerate=30/1,format=NV12" \
  ! nvv4l2h264enc insert-sps-pps=true iframeinterval=30 bitrate=2000000 \
  ! h264parse \
  ! flvmux streamable=true \
  ! rtmpsink location="rtmp://127.0.0.1:1935/camera-01 live=1"
