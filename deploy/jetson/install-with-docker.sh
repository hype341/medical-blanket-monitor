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

docker rm -f mediamtx >/dev/null 2>&1 || true
docker run -d \
  --restart unless-stopped \
  --name mediamtx \
  --network host \
  -v /opt/mediamtx/mediamtx.yml:/mediamtx.yml:ro \
  -v /var/lib/mediamtx/recordings:/recordings \
  "${IMAGE}"

install -m 755 camera-stream.sh /usr/local/bin/camera-stream.sh
install -m 644 camera-stream.service /etc/systemd/system/camera-stream.service
systemctl daemon-reload
systemctl enable --now camera-stream.service
