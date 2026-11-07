#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${CAMERA_ENV_FILE:-/etc/blanket/camera-stream.env}"
SERVICE_NAME="camera-stream.service"
SERVER=""
PORT=""
MEDIA_PATH=""
RESTART_SERVICE=1

usage() {
  cat <<'EOF'
用法：
  sudo setvdserver <服务器IP或域名> [选项]
  sudo setvdserver --show

选项：
  --port <端口>       MediaMTX RTMP 端口，默认保留当前值或 1935
  --path <路径>       摄像头媒体路径，默认保留当前值或 camera-01
  --no-restart        只保存配置，不重启 camera-stream 服务
  --show              显示当前推流目标和服务状态
  -h, --help          显示帮助

示例：
  sudo setvdserver 172.20.10.3
  sudo setvdserver monitor.example.com --port 1935 --path camera-01
EOF
}

fail() {
  echo "错误：$*" >&2
  exit 1
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "需要管理员权限，请使用 sudo setvdserver ..."
  fi
}

current_value() {
  local key="$1"
  local fallback="$2"
  local value=""
  if [[ -f "${ENV_FILE}" ]]; then
    value="$(awk -F= -v key="${key}" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "${ENV_FILE}")"
  fi
  printf '%s\n' "${value:-${fallback}}"
}

replace_value() {
  local key="$1"
  local value="$2"
  local directory
  local temporary
  directory="$(dirname "${ENV_FILE}")"
  mkdir -p "${directory}"
  temporary="$(mktemp "${directory}/camera-stream.env.XXXXXX")"
  awk -v key="${key}" -v value="${value}" '
    index($0, key "=") == 1 {
      if (!written) {
        print key "=" value
        written = 1
      }
      next
    }
    { print }
    END {
      if (!written) print key "=" value
    }
  ' "${ENV_FILE}" >"${temporary}"
  chown root:root "${temporary}"
  chmod 644 "${temporary}"
  mv "${temporary}" "${ENV_FILE}"
}

show_target() {
  local server
  local port
  local path
  local active
  server="$(current_value MEDIAMTX_HOST 127.0.0.1)"
  port="$(current_value MEDIAMTX_RTMP_PORT 1935)"
  path="$(current_value CAMERA_PATH camera-01)"
  active="$(systemctl is-active "${SERVICE_NAME}" 2>/dev/null || true)"
  printf '配置文件：%s\n' "${ENV_FILE}"
  printf '推流目标：rtmp://%s:%s/%s\n' "${server}" "${port}" "${path}"
  printf '服务状态：%s\n' "${active:-unknown}"
}

validate_server() {
  local server="$1"
  if [[ ! "${server}" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
    fail "服务器地址格式不正确：${server}"
  fi
  if (( ${#server} > 253 )); then
    fail "服务器地址过长"
  fi
}

validate_port() {
  local port="$1"
  if [[ ! "${port}" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
    fail "端口必须是 1-65535 之间的整数：${port}"
  fi
}

validate_path() {
  local path="$1"
  if [[ ! "${path}" =~ ^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*$ ]]; then
    fail "媒体路径只能包含字母、数字、下划线和连字符，可使用 / 分层：${path}"
  fi
}

test_target() {
  local server="$1"
  local port="$2"
  local resolved=""
  resolved="$(getent ahostsv4 "${server}" 2>/dev/null | awk 'NR == 1 {print $1}')"
  if [[ -z "${resolved}" ]]; then
    echo "警告：暂时无法解析 ${server}，配置仍会保存。" >&2
    return 1
  fi
  if timeout 3 bash -c "exec 3<>/dev/tcp/${resolved}/${port}" 2>/dev/null; then
    echo "网络检查：${server}:${port} 可连接"
    return 0
  fi
  echo "警告：${server}:${port} 当前不可连接，配置仍会保存；服务会持续自动重连。" >&2
  return 1
}

if [[ "$#" -eq 0 ]]; then
  usage
  exit 2
fi

if [[ "$1" == "--show" ]]; then
  show_target
  exit 0
fi

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  usage
  exit 0
fi

SERVER="$1"
shift
validate_server "${SERVER}"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --port)
      [[ "$#" -ge 2 ]] || fail "--port 缺少端口参数"
      PORT="$2"
      validate_port "${PORT}"
      shift 2
      ;;
    --path)
      [[ "$#" -ge 2 ]] || fail "--path 缺少媒体路径参数"
      MEDIA_PATH="$2"
      validate_path "${MEDIA_PATH}"
      shift 2
      ;;
    --no-restart)
      RESTART_SERVICE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "未知参数：$1"
      ;;
  esac
done

require_root
PORT="${PORT:-$(current_value MEDIAMTX_RTMP_PORT 1935)}"
MEDIA_PATH="${MEDIA_PATH:-$(current_value CAMERA_PATH camera-01)}"
validate_port "${PORT}"
validate_path "${MEDIA_PATH}"

install -d -m 755 "$(dirname "${ENV_FILE}")"
if [[ ! -f "${ENV_FILE}" ]]; then
  install -m 644 /dev/null "${ENV_FILE}"
fi
backup_file="${ENV_FILE}.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "${ENV_FILE}" "${backup_file}"

replace_value MEDIAMTX_HOST "${SERVER}"
replace_value MEDIAMTX_RTMP_PORT "${PORT}"
replace_value CAMERA_PATH "${MEDIA_PATH}"

echo "已保存推流目标：rtmp://${SERVER}:${PORT}/${MEDIA_PATH}"
echo "配置备份：${backup_file}"
test_target "${SERVER}" "${PORT}" || true

if [[ "${RESTART_SERVICE}" -eq 1 ]]; then
  systemctl daemon-reload
  systemctl restart "${SERVICE_NAME}"
  sleep 1
  if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
    echo "错误：${SERVICE_NAME} 启动失败。可执行以下命令恢复上一份配置：" >&2
    echo "  sudo cp -a ${backup_file} ${ENV_FILE}" >&2
    echo "  sudo systemctl restart ${SERVICE_NAME}" >&2
    exit 1
  fi
  echo "摄像头服务已重启：${SERVICE_NAME}"
fi

show_target
