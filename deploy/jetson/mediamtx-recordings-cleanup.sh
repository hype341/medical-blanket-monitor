#!/usr/bin/env bash
set -euo pipefail

RECORDINGS_DIR="${RECORDINGS_DIR:-/var/lib/mediamtx/recordings}"

if [[ ! -d "${RECORDINGS_DIR}" ]]; then
  exit 0
fi

# MediaMTX can leave empty MP4 files when a publisher disconnects mid-segment.
# The playback index aborts with EOF when one of these files is in range.
find "${RECORDINGS_DIR}" -type f -name '*.mp4' -size 0 -mmin +1 -delete
find "${RECORDINGS_DIR}" -type f \( -name '*.tmp' -o -name '*.part' \) -mmin +60 -delete
