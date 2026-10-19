#!/usr/bin/env bash
# OpenChamber service dispatcher for mmm1 (launchd label: com.mmm1.openchamber)
# Usage: scripts/server.sh --run | --start | --stop | --status
#
# --run    Foreground runtime. This is the launchd entry AND the manual-smoke entry.
# --start  Idempotently install the LaunchAgent, kickstart it, wait for readiness.
# --stop   Bootout the LaunchAgent (idempotent).
# --status Report launchd state + one reachability probe. Never prints secrets.
#
# Configuration: ~/.config/openchamber/server.env (0600, operator-created) supplies
# OPENCHAMBER_UI_PASSWORD / OPENCHAMBER_OPENCODE_PATH / OPENCHAMBER_SERVE_PORT
# when they are not already in the environment. Serve port default: 3011.

set -euo pipefail

LABEL="com.mmm1.openchamber"
LEGACY_LABEL="dev.openchamber.web"
DEFAULT_PORT=3011
ENV_FILE="$HOME/.config/openchamber/server.env"
LOG_DIR="$HOME/Library/Logs/OpenChamber"
PLIST_SRC="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/com.mmm1.openchamber.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.mmm1.openchamber.plist"

usage() {
  cat >&2 <<EOF
Usage: $(basename "${BASH_SOURCE[0]}") --run | --start | --stop | --status

  --run     Run the OpenChamber server in the foreground (launchd entry / manual smoke)
  --start   Install and start the '$LABEL' LaunchAgent (idempotent)
  --stop    Stop and unload the '$LABEL' LaunchAgent
  --status  Show launchd state and reachability (no secrets printed)
EOF
}

# Resolve the repo root from this script's own path and cd there.
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Conditional operator env load: only when the three keys are not already in env.
load_server_env() {
  if [[ -n "${OPENCHAMBER_UI_PASSWORD+set}" && -n "${OPENCHAMBER_OPENCODE_PATH+set}" && -n "${OPENCHAMBER_SERVE_PORT+set}" ]]; then
    return 0
  fi
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
  fi
}

resolved_port() {
  echo "${OPENCHAMBER_SERVE_PORT:-$DEFAULT_PORT}"
}

probe_port() {
  # Any HTTP answer counts as up: a non-000 http_code means the port answered.
  local code
  code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' "http://localhost:$(resolved_port)/" 2>/dev/null || true)"
  [[ "$code" != "000" && -n "$code" ]]
}

do_run() {
  mkdir -p "$LOG_DIR"
  if [[ ! -d "$REPO_ROOT/packages/web/dist" ]]; then
    echo "error: packages/web/dist is not built. Build it first (e.g. bun run build:web) before starting the server." >&2
    exit 1
  fi
  load_server_env
  # exec so launchd signals reach the server process directly.
  # CLI entry: packages/web/bin/cli.js; serve flags per bin/lib/cli-args.js
  # (--foreground, --host, --port, --ui-password). The port is OUR env layer
  # (OPENCHAMBER_SERVE_PORT, default 3011) — the CLI reads no port env var.
  exec node "$REPO_ROOT/packages/web/bin/cli.js" serve --foreground \
    --host 0.0.0.0 \
    --port "${OPENCHAMBER_SERVE_PORT:-$DEFAULT_PORT}" \
    --ui-password "$OPENCHAMBER_UI_PASSWORD"
}

do_start() {
  # Coexistence guard: the built-in dev.openchamber.web agent must not run
  # alongside ours — exactly one openchamber launchd entry.
  if launchctl list 2>/dev/null | grep -q "$LEGACY_LABEL"; then
    echo "warn: built-in '$LEGACY_LABEL' agent is loaded; booting it out (exactly one openchamber entry is required)" >&2
    launchctl bootout "gui/$UID/$LEGACY_LABEL" 2>/dev/null || true
    if launchctl list 2>/dev/null | grep -q "$LEGACY_LABEL"; then
      echo "error: '$LEGACY_LABEL' is still loaded after bootout; refusing to start alongside it." >&2
      exit 1
    fi
  fi

  mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

  # Install the plist when absent or changed.
  if [[ ! -f "$PLIST_DST" ]] || ! cmp -s "$PLIST_SRC" "$PLIST_DST"; then
    cp "$PLIST_SRC" "$PLIST_DST"
    echo "installed $PLIST_DST"
  fi

  # bootout before bootstrap (double-registration lesson), ignore "not loaded".
  launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true

  # Bootstrap with retry on "Bootstrap failed: 5" (seen on this host right after
  # a bootout; bounded at 5 attempts, 3 s apart).
  local attempt=0 out
  while :; do
    if out="$(launchctl bootstrap "gui/$UID" "$PLIST_DST" 2>&1)"; then
      break
    fi
    if [[ "$out" == *"Bootstrap failed: 5"* && $attempt -lt 4 ]]; then
      attempt=$((attempt + 1))
      echo "bootstrap retry $attempt/5 after: $out" >&2
      sleep 3
      continue
    fi
    echo "error: launchctl bootstrap failed: $out" >&2
    exit 1
  done

  launchctl kickstart -k "gui/$UID/$LABEL"

  # Bounded readiness wait on the resolved port (<=60 s).
  local port deadline=$((SECONDS + 60))
  port="$(resolved_port)"
  echo "waiting for http://localhost:$port/ (<=60 s)..."
  while ((SECONDS < deadline)); do
    if probe_port; then
      echo "openchamber is up on :$port (state: $(launchd_state))"
      return 0
    fi
    sleep 2
  done
  echo "error: server did not answer on :$port within 60 s" >&2
  exit 1
}

launchd_state() {
  local st
  st="$(launchctl print "gui/$UID/$LABEL" 2>/dev/null | awk '$1=="state" && $2=="=" {print $3; exit}')" || true
  if [[ -n "$st" ]]; then echo "$st"; else echo "not-loaded"; fi
}

do_stop() {
  launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
  echo "booted out gui/$UID/$LABEL (idempotent)"
}

do_status() {
  load_server_env
  local port state reachable
  port="$(resolved_port)"
  state="$(launchd_state)"
  if probe_port; then reachable="yes"; else reachable="no"; fi
  echo "label=$LABEL"
  echo "port=$port"
  echo "state=$state"
  echo "reachable=$reachable"
}

case "${1:-}" in
  --run) do_run ;;
  --start) do_start ;;
  --stop) do_stop ;;
  --status) do_status ;;
  *)
    usage
    exit 1
    ;;
esac
