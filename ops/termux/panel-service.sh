#!/data/data/com.termux/files/usr/bin/sh
# PocketHost-only runit entrypoints. Never infer ownership from a port or PID.
set -eu

PREFIX=/data/data/com.termux/files/usr
HOME=/data/data/com.termux/files/home
PANEL="$PREFIX/var/service/pockethost-panel"
STATE="$HOME/.local/state/pockethost"
CURL="$PREFIX/bin/curl"
SV="$PREFIX/bin/sv"

health() {
  code=$("$CURL" --noproxy '*' --connect-timeout 2 --max-time 5 \
    --silent --output /dev/null --write-out '%{http_code}' \
    http://127.0.0.1:8787/shizuku 2>/dev/null || :)
  [ "$code" = 200 ]
}

case "${1:-}" in
  run)
    root="${2:?verified PocketHost root required}"
    [ ! -L "$root" ] && [ -f "$root/package.json" ] && \
      [ -f "$root/apps/admin/node_modules/vite/bin/vite.js" ] || exit 111
    cd "$root/apps/admin"
    export HOME PREFIX
    # This process owns only PocketHost's loopback Vite server. The existing
    # Vite integration restores its Wi-Fi LAN gateway when the network returns.
    export POCKETHOST_LAN_AUTOSTART=1
    # Runit directly execs Vite; update only the verified prior PocketHost
    # owner markers to this same PID/start tick, never adopt a live outsider.
    "$PREFIX/bin/node" "$root/ops/termux/panel-owner.mjs" "$root" "$$" || exit 111
    exec "$PREFIX/bin/node" "$root/apps/admin/node_modules/vite/bin/vite.js" \
      --host 127.0.0.1 --port 8787 --strictPort
    ;;
  check)
    health
    ;;
  watch)
    [ "${2:?verified PocketHost root required}" = \
      "$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)" ] || exit 111
    mkdir -p "$STATE"
    failures=0
    last_restart=0
    # Initial compilation and LAN recovery must not trigger an early restart.
    sleep 50
    while :; do
      status=$("$SV" status "$PANEL" 2>/dev/null || :)
      case "$status" in
        run:*)
          if health; then
            if [ "$failures" -gt 0 ]; then
              printf '%s panel HTTP recovered\n' "$(date -Is)"
            fi
            failures=0
          else
            failures=$((failures + 1))
            now=$(date +%s)
            if [ "$failures" -ge 3 ] && [ $((now - last_restart)) -ge 120 ]; then
              # Only this fixed, registered runit service is signaled.
              # No arbitrary PID signals, process discovery, or external services.
              if "$SV" term "$PANEL" >/dev/null 2>&1; then
                printf '%s panel HTTP unhealthy; runit restart requested\n' "$(date -Is)"
                last_restart=$now
              else
                printf '%s panel HTTP unhealthy; supervised restart refused\n' "$(date -Is)"
              fi
              failures=0
            fi
          fi
          ;;
        *)
          # runit itself restarts a process that exited; do not send signals.
          failures=0
          ;;
      esac
      sleep 12
    done
    ;;
  *)
    printf 'usage: panel-service.sh {run ROOT|check|watch ROOT}\n' >&2
    exit 64
    ;;
esac
