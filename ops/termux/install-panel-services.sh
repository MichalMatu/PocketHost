#!/data/data/com.termux/files/usr/bin/sh
# One-time, owner-approved Termux installation. No changes to other services.
set -eu
PREFIX=/data/data/com.termux/files/usr
HOME=/data/data/com.termux/files/home
export HOME PREFIX
SVDIR="$PREFIX/var/service"
STATE="$HOME/.local/state/pockethost"
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
PANEL="$SVDIR/pockethost-panel"
WATCH="$SVDIR/pockethost-panel-watch"

fail() { printf 'PocketHost runit: %s\n' "$*" >&2; exit 1; }
origin=$("$PREFIX/bin/git" -C "$ROOT" remote get-url origin)
case "$origin" in
  *MichalMatu/PocketHost*) ;;
  *) fail 'unexpected repository origin' ;;
esac
[ ! -L "$ROOT" ] && [ -f "$ROOT/apps/admin/node_modules/vite/bin/vite.js" ] || \
  fail 'verified checkout/dependencies missing'
case "$ROOT" in
  *[!a-zA-Z0-9_./-]*) fail 'unsafe checkout path for service launcher' ;;
esac

write_service() {
  name=$1
  action=$2
  staging="$STATE/stage-$name"
  [ ! -e "$staging" ] && [ ! -L "$staging" ] || \
    fail "staging already exists: $name"
  mkdir -p "$staging/log" "$PREFIX/var/log/sv/$name"
  : > "$staging/down"
  printf '%s\n' "#!$PREFIX/bin/sh" \
    "exec $ROOT/ops/termux/panel-service.sh $action $ROOT" > "$staging/run"
  printf '%s\n' "#!$PREFIX/bin/sh" \
    "exec $ROOT/ops/termux/panel-service.sh check" > "$staging/check"
  printf '%s\n' "#!$PREFIX/bin/sh" \
    "exec $PREFIX/bin/svlogd -tt $PREFIX/var/log/sv/$name" > "$staging/log/run"
  printf '%s\n' "$ROOT" > "$staging/owner-root"
  chmod 700 "$staging/run" "$staging/check" "$staging/log/run"
  chmod 600 "$staging/down" "$staging/owner-root"
  mv "$staging" "$SVDIR/$name"
}
assert_installed() {
  for name in pockethost-panel pockethost-panel-watch; do
    dir="$SVDIR/$name"
    [ -d "$dir" ] && [ ! -L "$dir" ] && [ -f "$dir/owner-root" ] || \
      fail "service definition missing or linked: $name"
    [ "$(cat "$dir/owner-root")" = "$ROOT" ] || fail "service owned by another checkout: $name"
  done
}
ports_free() {
  "$PREFIX/bin/python3" - <<'PY'
import socket,sys
for addr,port in [('127.0.0.1',8787),('127.0.0.1',18787),('127.0.0.1',18878),('127.0.0.1',18879)]:
    # The standalone managed demo (18787) is NOT controlled by this service.
    # Check only the actual PocketHost panel and gateway listeners.
    if port==18787: continue
    with socket.socket() as sock:
        sock.settimeout(.8)
        if sock.connect_ex((addr,port))==0:
            print(f'occupied {addr}:{port}',file=sys.stderr);sys.exit(1)
PY
}
case "${1:-}" in
  stage)
    [ ! -e "$PANEL" ] && [ ! -L "$PANEL" ] && \
      [ ! -e "$WATCH" ] && [ ! -L "$WATCH" ] || \
      fail 'already registered; refusing to replace a live service'
    ports_free || fail 'existing panel/gateway listener; do not adopt a foreign process'
    mkdir -p "$STATE"
    write_service pockethost-panel run
    write_service pockethost-panel-watch watch
    assert_installed
    printf 'STAGED: two disabled PocketHost-only runit services\n'
    ;;
  activate)
    assert_installed
    [ -f "$PANEL/down" ] && [ -f "$WATCH/down" ] || \
      fail 'services not in disabled staging state'
    ports_free || fail 'panel/gateway port already occupied'
    # The existing Termux:Boot 00-services starts the standard service-daemon.
    # runsvdir discovers service directories; no second manager/boot hook.
    SVDIR="$SVDIR" "$PREFIX/bin/sv-enable" pockethost-panel
    ready=0
    n=0
    while [ "$n" -lt 85 ]; do
      n=$((n+1))
      if "$PREFIX/bin/sv" check "$PANEL" >/dev/null 2>&1; then ready=1; break; fi
      sleep 1
    done
    if [ "$ready" -ne 1 ]; then
      SVDIR="$SVDIR" "$PREFIX/bin/sv-disable" pockethost-panel || :
      fail 'panel did not pass loopback HTTP check; panel disabled (no other services changed)'
    fi
    if ! SVDIR="$SVDIR" "$PREFIX/bin/sv-enable" pockethost-panel-watch; then
      SVDIR="$SVDIR" "$PREFIX/bin/sv-disable" pockethost-panel || :
      fail 'watchdog did not enable; panel disabled'
    fi
    "$PREFIX/bin/sv" status "$PANEL"
    "$PREFIX/bin/sv" status "$WATCH"
    "$PREFIX/bin/sv" check "$PANEL"
    printf 'ACTIVE: supervised PocketHost panel and independent HTTP watchdog\n'
    ;;
  status)
    assert_installed
    "$PREFIX/bin/sv" status "$PANEL"
    "$PREFIX/bin/sv" status "$WATCH"
    "$PREFIX/bin/sv" check "$PANEL"
    ;;
  *)
    printf 'usage: install-panel-services.sh {stage|activate|status}\n' >&2
    exit 64
    ;;
esac
