#!/data/data/com.termux/files/usr/bin/sh
# PocketHost clean-install entrypoint for official Termux. Run as the Termux user.
# This is intentionally NOT an upgrade or migration tool.
set -eu
EXPECTED_PREFIX='/data/data/com.termux/files/usr'
EXPECTED_HOME='/data/data/com.termux/files/home'
ROOT="$EXPECTED_HOME/Projects/PocketHost-Standalone"
STATE="$EXPECTED_HOME/.local/state/pockethost"
SVDIR="$EXPECTED_PREFIX/var/service"
ORIGIN="https://github.com/MichalMatu/PocketHost.git"
REF="${POCKETHOST_REF:-main}"
fail() { printf "PocketHost installation refused: %s\n" "$*" >&2; exit 1; }
[ "$#" -eq 0 ] || fail "usage: sh install.sh (set POCKETHOST_REF for a release tag)"
[ "${PREFIX:-}" = "$EXPECTED_PREFIX" ] && [ "${HOME:-}" = "$EXPECTED_HOME" ] || fail "official Termux installation required"
[ "$(id -u)" -ne 0 ] || fail "do not install as root"
command -v pkg >/dev/null 2>&1 || fail "Termux pkg manager is missing"
case "$REF" in
  main | v[0-9]*.[0-9]*.[0-9]*) ;;
  *) fail "ref must be main or an explicit vX.Y.Z release tag" ;;
esac
# All ownership/foreign-service checks happen before package installation.
[ ! -e "$ROOT" ] && [ ! -L "$ROOT" ] || fail "checkout exists; refusing to overwrite or upgrade"
[ ! -e "$SVDIR/pockethost-panel" ] && [ ! -L "$SVDIR/pockethost-panel" ] || fail "PocketHost panel service already registered"
[ ! -e "$SVDIR/pockethost-panel-watch" ] && [ ! -L "$SVDIR/pockethost-panel-watch" ] || fail "PocketHost watchdog already registered"
[ ! -e "$STATE/panel-owner.json" ] && [ ! -L "$STATE/panel-owner.json" ] || fail "PocketHost owner state already exists"
[ ! -e "$STATE/lan-gateway.json" ] && [ ! -L "$STATE/lan-gateway.json" ] || fail "PocketHost LAN state already exists"
[ ! -e "$STATE/stage-pockethost-panel" ] && [ ! -L "$STATE/stage-pockethost-panel" ] || fail "stale panel stage requires inspection"
[ ! -e "$STATE/stage-pockethost-panel-watch" ] && [ ! -L "$STATE/stage-pockethost-panel-watch" ] || fail "stale watchdog stage requires inspection"
printf "Installing PocketHost prerequisites using Termux pkg...\n"
pkg install -y git curl nodejs python termux-services
for binary in git node npm python3 sv sv-enable service-daemon curl; do
  command -v "$binary" >/dev/null 2>&1 || fail "missing required executable: $binary"
done
node -e "if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1)" || fail "Node.js 22+ is required"
[ -d "$EXPECTED_HOME/Projects" ] && [ ! -L "$EXPECTED_HOME/Projects" ] || mkdir -p "$EXPECTED_HOME/Projects"
[ ! -L "$EXPECTED_HOME/Projects" ] || fail "unsafe Projects symlink"
printf "Cloning PocketHost source (%s)...\n" "$REF"
"$EXPECTED_PREFIX/bin/git" clone --depth 1 --branch "$REF" --single-branch "$ORIGIN" "$ROOT"
[ "$("$EXPECTED_PREFIX/bin/git" -C "$ROOT" remote get-url origin)" = "$ORIGIN" ] || fail "unexpected origin"
SHA=$("$EXPECTED_PREFIX/bin/git" -C "$ROOT" rev-parse HEAD)
case "$SHA" in *[!a-f0-9]* | "") fail "invalid source commit" ;; esac
[ "${#SHA}" -eq 40 ] || fail "source commit must be a full SHA"
printf "Installing pinned npm dependencies...\n"
(cd "$ROOT" && npm ci --ignore-scripts --no-audit --no-fund)
(cd "$ROOT/apps/admin" && npm ci --ignore-scripts --no-audit --no-fund)
# Install only the two PocketHost-owned runit services. Never restart other services.
export PREFIX="$EXPECTED_PREFIX" HOME="$EXPECTED_HOME" SVDIR
[ -d "$SVDIR" ] && [ ! -L "$SVDIR" ] || fail "runit service directory unavailable"
DAEMON_PID="$EXPECTED_PREFIX/var/run/service-daemon.pid"
if [ -f "$DAEMON_PID" ] && kill -0 "$(cat "$DAEMON_PID")" 2>/dev/null; then
  : # Existing runsvdir remains untouched.
else
  # Starting an absent global daemon could activate other enabled services.
  for svc in "$SVDIR"/*; do
    [ -e "$svc" ] || [ -L "$svc" ] || continue
    [ -d "$svc" ] && [ -f "$svc/down" ] || fail "runit has existing enabled/unknown services; start it manually before installing"
  done
  "$EXPECTED_PREFIX/bin/service-daemon" start
fi
printf "Bootstrapping owned panel services...\n"
(cd "$ROOT" && "$EXPECTED_PREFIX/bin/node" ops/termux/cold-bootstrap-standalone.mjs "$SHA")
printf "\nPocketHost installed successfully.\n"
printf "Private panel (on device): http://127.0.0.1:8787/\n"
printf "LAN address: open the panel Network Access settings on a trusted private network.\n"
printf "This installer does not configure Android Termux:Boot or expose any public endpoint.\n"
