#!/usr/bin/env bash
set -euo pipefail

IMAGE="${MEDIAMTX_IMAGE:-docker.1ms.run/bluenviron/mediamtx:latest}"

mkdir -p /opt/mediamtx /var/lib/mediamtx/recordings

if [[ ! -f /opt/mediamtx/mediamtx.yml ]]; then
  docker rm -f mediamtx-config-template >/dev/null 2>&1 || true
  docker create --name mediamtx-config-template "${IMAGE}" >/dev/null
  docker cp mediamtx-config-template:/mediamtx.yml /opt/mediamtx/mediamtx.yml
  docker rm mediamtx-config-template >/dev/null
  sed -i 's/^  record: false/  record: true/' /opt/mediamtx/mediamtx.yml
  sed -i 's/^playback: false/playback: true/' /opt/mediamtx/mediamtx.yml
  sed -i 's/^  recordSegmentDuration: 1h/  recordSegmentDuration: 1m/' /opt/mediamtx/mediamtx.yml
  sed -i 's/^  recordDeleteAfter: 1d/  recordDeleteAfter: 24h/' /opt/mediamtx/mediamtx.yml
fi

if docker inspect mediamtx >/dev/null 2>&1; then
  docker update --restart unless-stopped mediamtx >/dev/null
else
  docker run -d \
    --restart unless-stopped \
    --name mediamtx \
    --network host \
    -v /opt/mediamtx/mediamtx.yml:/mediamtx.yml:ro \
    -v /var/lib/mediamtx/recordings:/recordings \
    "${IMAGE}"
fi

install -m 755 camera-stream.sh /usr/local/bin/camera-stream.sh
install -m 644 camera-stream.service /etc/systemd/system/camera-stream.service
install -m 755 mediamtx-recordings-cleanup.sh /usr/local/bin/mediamtx-recordings-cleanup.sh
install -m 644 blanket-recordings-cleanup.service /etc/systemd/system/blanket-recordings-cleanup.service
install -m 644 blanket-recordings-cleanup.timer /etc/systemd/system/blanket-recordings-cleanup.timer

if [[ ! -f /etc/blanket/camera-stream.env ]]; then
  install -d -m 755 /etc/blanket
  cat >/etc/blanket/camera-stream.env <<'EOF'
CAMERA_PATH=camera-01
CAMERA_SENSOR_ID=0
CAMERA_WIDTH=1280
CAMERA_HEIGHT=720
CAMERA_FPS=30
CAMERA_BITRATE=2000000
MEDIAMTX_HOST=127.0.0.1
MEDIAMTX_RTMP_PORT=1935
EOF
fi

if [[ -n "${WIFI_CONNECTION:-}" ]]; then
  nmcli connection modify "${WIFI_CONNECTION}" \
    connection.autoconnect yes \
    connection.autoconnect-priority 100 \
    connection.autoconnect-retries 0 \
    802-11-wireless.powersave 2
  systemctl enable NetworkManager-wait-online.service
fi

systemctl daemon-reload
systemctl enable --now camera-stream.service blanket-recordings-cleanup.timer
