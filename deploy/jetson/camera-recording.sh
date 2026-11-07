#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"
STATE_FILE="/etc/blanket/camera-recording.env"
CONFIG_FILE="/opt/mediamtx/mediamtx.yml"

current_state() {
  local value="true"
  if [[ -f "${STATE_FILE}" ]]; then
    value="$(awk -F= '$1 == "RECORDING_ENABLED" {print $2; exit}' "${STATE_FILE}")"
  fi
  printf '%s\n' "${value:-true}"
}

show_status() {
  local enabled
  local config
  enabled="$(current_state)"
  config="$(awk '/^  record:/ {print $2; exit}' "${CONFIG_FILE}" 2>/dev/null || true)"
  printf '录像开关：%s\n' "${enabled}"
  printf 'MediaMTX record：%s\n' "${config:-unknown}"
}

if [[ "${ACTION}" == "status" ]]; then
  show_status
  exit 0
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 sudo blanket-camera-recording on|off|status" >&2
  exit 1
fi

case "${ACTION}" in
  on)
    enabled=true
    ;;
  off)
    enabled=false
    ;;
  *)
    echo "用法：sudo blanket-camera-recording on|off|status" >&2
    exit 2
    ;;
esac

install -d -m 755 /etc/blanket
printf 'RECORDING_ENABLED=%s\n' "${enabled}" >"${STATE_FILE}"
chmod 644 "${STATE_FILE}"
sed -i "s/^  record:.*/  record: ${enabled}/" "${CONFIG_FILE}"
docker restart mediamtx >/dev/null
sleep 3
systemctl restart camera-stream.service
sleep 2
show_status
