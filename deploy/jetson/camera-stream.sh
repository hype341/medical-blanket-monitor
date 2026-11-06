#!/usr/bin/env bash
set -euo pipefail

CAMERA_PATH="${CAMERA_PATH:-camera-01}"
CAMERA_SENSOR_ID="${CAMERA_SENSOR_ID:-0}"
CAMERA_WIDTH="${CAMERA_WIDTH:-1280}"
CAMERA_HEIGHT="${CAMERA_HEIGHT:-720}"
CAMERA_FPS="${CAMERA_FPS:-30}"
CAMERA_BITRATE="${CAMERA_BITRATE:-2000000}"
MEDIAMTX_HOST="${MEDIAMTX_HOST:-127.0.0.1}"
MEDIAMTX_RTMP_PORT="${MEDIAMTX_RTMP_PORT:-1935}"

exec gst-launch-1.0 -e \
  nvarguscamerasrc sensor-id="${CAMERA_SENSOR_ID}" \
  ! "video/x-raw(memory:NVMM),width=${CAMERA_WIDTH},height=${CAMERA_HEIGHT},framerate=${CAMERA_FPS}/1,format=NV12" \
  ! nvv4l2h264enc insert-sps-pps=true iframeinterval="${CAMERA_FPS}" bitrate="${CAMERA_BITRATE}" \
  ! h264parse \
  ! flvmux streamable=true \
  ! rtmpsink location="rtmp://${MEDIAMTX_HOST}:${MEDIAMTX_RTMP_PORT}/${CAMERA_PATH} live=1"
