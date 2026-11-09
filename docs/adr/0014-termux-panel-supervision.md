---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Owner-approved PocketHost DEV panel autostart and self-healing exception
---

# ADR-0014 — PocketHost panel under existing Termux runit

## Decision

The owner explicitly superseded the earlier **no PocketHost autostart**
assumption on 2026-11-09 for the **single PocketHost administration
panel**. This is a DEV convenience service, not authorization to autostart
external applications, managed sites, Shizuku, or a public HTTP server.

Reuse the existing Termux:Boot `00-services` and its ordinary
`service-daemon` / `runsvdir`. Register two isolated services:

- `pockethost-panel`: directly supervised Vite Node process, fixed
  `127.0.0.1:8787`, restart on process exit.
- `pockethost-panel-watch`: probe the _local panel HTTP_ every 12 seconds,
  with a 50-second initial grace period. Only after three consecutive
  failures and at least a 120-second cooldown may it request `sv term`
  on that exact registered PocketHost panel service.

The existing Vite session owns LAN gateway recovery on the actual private
Wi-Fi interface at ports 18878/18879. The watchdog **must not** restart
Vite merely because Wi-Fi, Shizuku or Android Binder is unavailable, or
because the user disabled the gateway within the session.

Stage both runit definitions with `down` markers. Explicit activation
requires an otherwise free owned panel/gateway port set, the exact
PocketHost checkout, and a successful local HTTP readiness check. Never
adopt a discovered process based solely on its PID, name or port. Never
modify the separate `sshd`, `cloudflared`, `mosquitto`,
`wreckscanner`, `ilestoi-healthwatch`, or `termux-agent` service.

The source-controlled scripts are
`ops/termux/panel-service.sh` and
`ops/termux/install-panel-services.sh`. Termux hosts them from the
verified checkout; no duplicate process manager or second Termux:Boot
hook is installed.

## Failure behavior and limits

Runit restarts a crashed process. Repeated healthy-process HTTP failures
are bounded by the watchdog threshold and cooldown; the watchdog signals
only the registered panel runit service, never unrelated PIDs or ports.
The app's existing LAN self-recovery handles late Wi-Fi availability and
gateway faults.

If Android force-stops Termux, no in-app monitor can run. Termux:Boot may
restart the service following a full phone boot, subject to Android/OEM
background restrictions. Opening Termux manually can still be necessary.

The private LAN administration page currently has **no login/TLS**.
Neither autostart nor self-healing permits WAN exposure or port forwarding.

## Acceptance gates

1. Native Samsung source syntax and negative checks on the latest main SHA.
2. Both service definitions staged disabled and a fresh host-service
   ownership audit; no collision with an existing manual panel.
3. Supervised start, local 200, LAN HTTP 200, and all six protected
   existing Termux services unchanged.
4. A controlled panel-only crash/hang recovery probe and a genuine
   restart/Termux:Boot acceptance. Do not claim reboot PASS without a
   physical reboot test.
5. Preserve the prior checkout/source and boot-service backups for
   an individually verified rollback.

The code/design publication is separate from physical acceptance;
pending results remain **OPEN** until read from the actual host.
