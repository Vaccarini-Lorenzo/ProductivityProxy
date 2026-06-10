#!/usr/bin/env bash
set -euo pipefail

: "${PRODUCTIVE_PROXY_LISTEN_HOST:?Missing PRODUCTIVE_PROXY_LISTEN_HOST}"
: "${PRODUCTIVE_PROXY_LISTEN_PORT:?Missing PRODUCTIVE_PROXY_LISTEN_PORT}"
: "${PRODUCTIVE_PROXY_AUTH_ENABLED:?Missing PRODUCTIVE_PROXY_AUTH_ENABLED}"
: "${PRODUCTIVE_PROXY_CONFIG_PATH:?Missing PRODUCTIVE_PROXY_CONFIG_PATH}"
: "${PRODUCTIVE_PROXY_STATE_PATH:?Missing PRODUCTIVE_PROXY_STATE_PATH}"
: "${PRODUCTIVE_PROXY_EVENT_LOG_PATH:?Missing PRODUCTIVE_PROXY_EVENT_LOG_PATH}"
: "${POLICY_MAX_STEPS:?Missing POLICY_MAX_STEPS}"
: "${PRODUCTIVE_PROXY_TELEMETRY_VERBOSE:?Missing PRODUCTIVE_PROXY_TELEMETRY_VERBOSE}"
: "${PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES:?Missing PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES}"
: "${PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS:?Missing PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS}"

if [[ "$PRODUCTIVE_PROXY_AUTH_ENABLED" != "true" && "$PRODUCTIVE_PROXY_AUTH_ENABLED" != "false" ]]; then
  echo "PRODUCTIVE_PROXY_AUTH_ENABLED must be 'true' or 'false'" >&2
  exit 1
fi

if [[ ! -f "$PRODUCTIVE_PROXY_CONFIG_PATH" ]]; then
  mkdir -p "$(dirname "$PRODUCTIVE_PROXY_CONFIG_PATH")"
  python3 - "$PRODUCTIVE_PROXY_CONFIG_PATH" <<'PY'
import json
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
repo_root = Path.cwd()
default_path = repo_root / "src/proxy/defaults/default_config.json"
config = json.loads(default_path.read_text(encoding="utf-8"))
for node in config["customNodes"]:
    path = Path(node["path"])
    if not path.is_absolute():
        node["path"] = str(repo_root / path)
config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
PY
fi

args=(
  --listen-host "$PRODUCTIVE_PROXY_LISTEN_HOST"
  --listen-port "$PRODUCTIVE_PROXY_LISTEN_PORT"
  -s src/proxy/addons/policy_proxy.py
  --set "productive_config_path=$PRODUCTIVE_PROXY_CONFIG_PATH"
  --set "productive_state_path=$PRODUCTIVE_PROXY_STATE_PATH"
  --set "productive_event_log_path=$PRODUCTIVE_PROXY_EVENT_LOG_PATH"
)

if [[ "$PRODUCTIVE_PROXY_AUTH_ENABLED" == "true" ]]; then
  : "${PRODUCTIVE_PROXY_AUTH_USERNAME:?Missing PRODUCTIVE_PROXY_AUTH_USERNAME}"
  : "${PRODUCTIVE_PROXY_AUTH_PASSWORD:?Missing PRODUCTIVE_PROXY_AUTH_PASSWORD}"

  if [[ "$PRODUCTIVE_PROXY_AUTH_USERNAME" == *:* || "$PRODUCTIVE_PROXY_AUTH_PASSWORD" == *:* ]]; then
    echo "PRODUCTIVE_PROXY_AUTH_USERNAME and PRODUCTIVE_PROXY_AUTH_PASSWORD must not contain ':'" >&2
    exit 1
  fi

  args+=(--proxyauth "$PRODUCTIVE_PROXY_AUTH_USERNAME:$PRODUCTIVE_PROXY_AUTH_PASSWORD")
fi

exec mitmdump "${args[@]}"
