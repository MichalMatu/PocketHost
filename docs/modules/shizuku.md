---
status: source-candidate
owner: shizuku
last_reviewed: 2026-11-08
purpose: Native Shizuku-backed Android power-user integration
---

# Shizuku Module

This module is the foundation for broad Android power-user operations
inside PocketHost. It is not a security-restricted demo or read-only
end-state. The user chooses what to manage. Actual Android ADB/root
capabilities and Shizuku's own authorization define the limits.

## Interfaces

- `src/shared/shizuku.ts`: initial typed session/privilege/capability
  model; new capabilities are negotiated dynamically.
- `/shizuku`: owner-facing UI hub, installed-app evidence,
  native connection state and planned capability surfaces.
- Future `PocketHost Companion`: Android app linking Shizuku SDK via
  Binder, explicitly requesting Shizuku authorization from the user.
- Future IPC: local type-safe bridge between companion and Termux,
  with explicit operation target and result reporting.

## Status and first device evidence

Samsung SM-S906B, Android 16; Shizuku app installed.
Mac ADB `dumpsys cpuinfo` returned a genuine 31% TOTAL sample.
No native PocketHost companion exists yet and Shizuku per-app
authorization is **not verified**. The current hub does not
claim service connection or execute privileged operations.

## Incremental delivery

Implement real Shizuku connection state first; then true CPU/
process telemetry and more extensive Android apps/packages,
permissions, services, settings, backup, storage and advanced
shell control. Avoid artificial feature bans, pretend grants
and heavy tests for tiny UI changes. Preserve the existing DEV
panel and the user's explicit intent for mutations.

[ADR-0013](../adr/0013-shizuku-power-user.md)

## UI boundary — 2026-11-08

**Android & Shizuku** owns full-device CPU utilization and Android-wide
process telemetry, separate from ordinary Termux monitoring. Its page
has capability cards and will consume a typed local companion status
endpoint when implemented. Connected/authorized state must come from
real bridge evidence, not from a previous ADB diagnostic or an installed
app package. Controls must execute actual owner-directed actions and
report success or refusal; no placebo authorization button.

## Native companion implementation — 2026-11-08

Source: `native/pockethost-companion`. First Android Java Shizuku SDK
client requests device-user permission, identifies real shell/root UID,
binds a Shizuku `UserService` and reads a bounded native CPU `dumpsys
cpuinfo` TOTAL sample plus visible-process count. Debug APK build and
physical on-device authorization must be verified separately.
The PocketHost browser still reports *companion unavailable* until an
owner-authorized local status IPC bridge exists; do not infer connected
state from this source commit or from Shizuku Manager installation.

## First local read-only web bridge (2026-11-08)

The Companion app exports only a **Termux/shell UID-local read-only**
ContentProvider at `content://pl.pockethost.companion.telemetry/status`.
A foreground authorized Shizuku service samples full Android CPU and
process count and publishes a short-lived typed snapshot (30-second TTL).
PocketHost's loopback Vite endpoint `/api/v1/shizuku/status` reads this
provider via the fixed Android `content read` CLI. The LAN gateway can
forward read-only telemetry; it does NOT forward a Binder handle or generic
ADB/root command execution. This is not the final always-on/control bridge.

If Companion is backgrounded for 30 seconds, values expire: a user-visible
Android foreground service for persistent sampling is a next-phase task.
Only accept physical Android evidence and authorized Shizuku state, never
infer privileges from installed package names.

## Android 16 transport correction

Samsung Android 16 prevents the Termux app from starting the Android
`content` CLI (`app_process` inaccessible). The provider remains useful
for ADB inspection, but the actual Termux backend uses a **fixed read-only
HTTP status bridge on Android loopback 127.0.0.1:18791**. It is started by
the Companion app, handles only `GET /status`, and shares no Binder handle,
privileged shell or mutation API. The Vite server uses a fixed loopback
fetch and its existing no-store / read-only status route. No Wi-Fi listener
or background Android service was created.

## Background telemetry fix — 2026-11-08

Physical Mac→Samsung SSH evidence: while Companion was in the cached state,
TCP connection to its Android loopback listener `127.0.0.1:18791`
timed out although the port appeared to be listening. Reopening the
Companion activity restored immediate HTTP 200 and a legitimate Shizuku
sample of 19% CPU / 855 processes in ADB mode. Android cached-app
freezing suspends app threads, so an invisible socket listener alone
cannot maintain telemetry. The Android-native foreground service now
retains sampling in the background with a visible notification and an
explicit Stop control. This does not grant new privileges.

This source change requires a **new APK build and physical re-test**.
Existing LAN routes `/dashboard` and `/shizuku` were both HTTP 200
at the last Mac SSH audit; deploy status of the new foreground service
remains separate.


## Next source slice — installed Android applications (2026-11-08)

The native Shizuku UserService reads Android package names through fixed
shell-privileged package-manager queries (all and third-party packages).
The Companion foreground service caches a bounded 1024-entry inventory
and refreshes it every two minutes. Only a fresh authorized session
can expose the cached data via fixed loopback read-only \`GET /apps\`.
PocketHost forwards the typed result to \`GET /api/v1/shizuku/apps\`
and displays searchable user/system package names under Android & Shizuku.

This is **source-only until a new APK, backend update and physical
Samsung check confirm the exact revision**. No browser action installs,
disables, grants or uninstalls Android applications. Privileged mutations
require a separate owner-authenticated native execution boundary; the
trusted LAN dashboard currently does not provide that boundary.


## Seven-module power-user sprint — source candidate, 2026-11-08

The native Companion now defines verified, user-initiated Shizuku operations.
It requests a package identity, target PID, permission, Android service
component, setting value or shell command on the **phone itself** and
displays an explicit confirmation before a Binder call. Supported native
operations include app launch/force-stop/uninstall-for-user, runtime
permission grant/revoke, process TERM, service start/stop, brightness,
screen timeout and advanced shell (bounded output and timeout).
Android errors and ADB-vs-root limitations must be reported as failures.

The fixed read-only foreground bridge additionally samples a bounded
process inventory (PID, process, owner, RSS and CPU if supported),
battery, RAM, device settings and Android services into a new
\`GET /system\` endpoint, forwarded from loopback to
\`GET /api/v1/shizuku/system\`. Browser pages use section navigation,
search and typed availability. No browser-to-native privileged write
route exists; current trusted LAN has no owner authentication.

**Acceptance remains OPEN:** source compilation, exact-SHA native
Termux tests, APK installation, Samsung Android 16 hardware observation,
positive and negative permission/management operations on a disposable
test package, and owner UX inspection must be recorded separately.
Do not claim all Android service/permission operations work until the
OS accepts them on the target device.
