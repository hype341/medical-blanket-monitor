#!/usr/bin/env bash
set -euo pipefail

RECORDINGS_DIR="${RECORDINGS_DIR:-/var/lib/mediamtx/recordings}"
LOG_VACUUM_SIZE="${LOG_VACUUM_SIZE:-100M}"
LOW_MEMORY_PERCENT="${LOW_MEMORY_PERCENT:-15}"

if [[ -d "${RECORDINGS_DIR}" ]]; then
  find "${RECORDINGS_DIR}" -type f -name '*.mp4' -size 0 -mmin +1 -delete
  find "${RECORDINGS_DIR}" -type f \( -name '*.tmp' -o -name '*.part' \) -mmin +60 -delete
  find "${RECORDINGS_DIR}" -type f -mmin +1440 -delete
fi

journalctl --vacuum-size="${LOG_VACUUM_SIZE}" >/dev/null 2>&1 || true

mem_total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
mem_available_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
if [[ -n "${mem_total_kb}" && -n "${mem_available_kb}" ]]; then
  available_percent=$((mem_available_kb * 100 / mem_total_kb))
  if (( available_percent < LOW_MEMORY_PERCENT )); then
    sync
    echo "available memory ${available_percent}% is below ${LOW_MEMORY_PERCENT}%; dropping page cache"
    echo 1 >/proc/sys/vm/drop_caches
  else
    echo "available memory ${available_percent}%"
  fi
fi
