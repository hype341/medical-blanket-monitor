#!/usr/bin/env bash
set -euo pipefail

RECORDINGS_DIR="${RECORDINGS_DIR:-/var/lib/mediamtx/recordings}"
LOG_VACUUM_SIZE="${LOG_VACUUM_SIZE:-100M}"
LOW_MEMORY_PERCENT="${LOW_MEMORY_PERCENT:-50}"
RECORDING_MAX_HOURS="${RECORDING_MAX_HOURS:-24}"
RECORDING_MIN_HOURS="${RECORDING_MIN_HOURS:-1}"
RECORDING_DISK_RESERVE_PERCENT="${RECORDING_DISK_RESERVE_PERCENT:-15}"
CAMERA_ENV_FILE="${CAMERA_ENV_FILE:-/etc/blanket/camera-stream.env}"
RETENTION_STATUS_FILE="${RETENTION_STATUS_FILE:-/var/lib/blanket-camera/retention-status}"

read_env_value() {
  local key="$1"
  local fallback="$2"
  local value=""
  if [[ -f "${CAMERA_ENV_FILE}" ]]; then
    value="$(awk -F= -v key="${key}" '$1 == key {print $2; exit}' "${CAMERA_ENV_FILE}")"
  fi
  printf '%s\n' "${value:-${fallback}}"
}

if [[ -d "${RECORDINGS_DIR}" ]]; then
  find "${RECORDINGS_DIR}" -type f -name '*.mp4' -size 0 -mmin +1 -delete
  find "${RECORDINGS_DIR}" -type f \( -name '*.tmp' -o -name '*.part' \) -mmin +60 -delete

  filesystem_kb="$(df -Pk "${RECORDINGS_DIR}" | awk 'NR == 2 {print $2}')"
  available_kb="$(df -Pk "${RECORDINGS_DIR}" | awk 'NR == 2 {print $4}')"
  reserve_kb=$((filesystem_kb * RECORDING_DISK_RESERVE_PERCENT / 100))
  recording_budget_kb=$((available_kb > reserve_kb ? available_kb - reserve_kb : 0))
  bitrate="$(
    read_env_value CAMERA_BITRATE 300000
  )"
  if [[ ! "${bitrate}" =~ ^[0-9]+$ ]] || (( bitrate < 1 )); then
    bitrate=300000
  fi
  bytes_per_hour=$((bitrate * 3600 / 8))
  kilobytes_per_hour=$((bytes_per_hour / 1024))
  calculated_hours=$((recording_budget_kb * 4 / 5 / kilobytes_per_hour))
  if (( calculated_hours < RECORDING_MIN_HOURS )); then
    calculated_hours="${RECORDING_MIN_HOURS}"
  fi
  if (( calculated_hours > RECORDING_MAX_HOURS )); then
    calculated_hours="${RECORDING_MAX_HOURS}"
  fi
  retention_minutes=$((calculated_hours * 60))
  find "${RECORDINGS_DIR}" -type f -name '*.mp4' -mmin +"${retention_minutes}" -delete

  available_kb="$(df -Pk "${RECORDINGS_DIR}" | awk 'NR == 2 {print $4}')"
  emergency_need_kb=$((reserve_kb > available_kb ? reserve_kb - available_kb : 0))
  removed_for_reserve=0
  if (( emergency_need_kb > 0 )); then
    while IFS=$'\t' read -r timestamp file; do
      [[ -n "${file}" ]] || continue
      size_kb="$(du -k "${file}" | awk '{print $1}')"
      rm -f -- "${file}"
      removed_for_reserve=$((removed_for_reserve + size_kb))
      emergency_need_kb=$((emergency_need_kb - size_kb))
      if (( emergency_need_kb <= 0 )); then
        break
      fi
    done < <(find "${RECORDINGS_DIR}" -type f -name '*.mp4' -mmin +2 -printf '%T@\t%p\n' | sort -n)
  fi

  available_kb="$(df -Pk "${RECORDINGS_DIR}" | awk 'NR == 2 {print $4}')"
  mkdir -p "$(dirname "${RETENTION_STATUS_FILE}")"
  {
    printf 'updatedAt=%s\n' "$(date -Iseconds)"
    printf 'calculatedHours=%s\n' "${calculated_hours}"
    printf 'reservePercent=%s\n' "${RECORDING_DISK_RESERVE_PERCENT}"
    printf 'filesystemAvailableKB=%s\n' "${available_kb}"
    printf 'removedForReserveKB=%s\n' "${removed_for_reserve}"
  } >"${RETENTION_STATUS_FILE}"
  echo "recording retention: ${calculated_hours}h, free ${available_kb}KB, removed ${removed_for_reserve}KB for reserve"
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
    mem_available_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
    available_after=$((mem_available_kb * 100 / mem_total_kb))
    echo "available memory after cleanup: ${available_after}%"
  else
    echo "available memory ${available_percent}%"
  fi
fi
