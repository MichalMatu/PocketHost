---
status: in-progress
owner: core
last_reviewed: 2026-11-09
purpose: Track the single PocketHost administration panel boot and self-healing implementation and physical acceptance
---

# PocketHost — Termux panel self-healing and autostart

## Trigger

After the Samsung Termux app was restarted, the prior manual PocketHost
Vite process and the owner LAN gateway were gone. The stored owner
markers still pointed to the earlier process. Old guarded cutover tasks
refused to take over that stale owner, which is the correct fail-closed
behavior. A later `1b3e17f` cold-start attempt stopped before mutation
when the source `main` changed during its SHA-pinned QA. Neither result
proves a functioning panel at the newer source SHA.

The owner explicitly requested that PocketHost receive the same general
autostart and health-recovery behavior as the already managed Termux
services. [ADR-0014](../adr/0014-termux-panel-supervision.md) supersedes
the previous no-autostart rule **only for the DEV admin panel**.

## Source implementation

- `ops/termux/panel-service.sh`: direct Vite service at
  `127.0.0.1:8787`, HTTP readiness and loopback-only watchdog. Runit
  handles crashes; the watchdog can signal only its own registered
  PocketHost service after sustained failed HTTP responses.
- `ops/termux/panel-owner.mjs`: validates both existing PocketHost DEV
  owner markers, verifies that the prior owner is gone, and records
  runit's exact PID/start ticks/source SHA. No adoption of live foreign
  processes.
- `ops/termux/install-panel-services.sh`: separate disabled staging
  and guarded activation, fixed service names, private port exclusion,
  and a rollback-to-disabled behavior if readiness fails.
- `tests/quality/panel-autostart.test.mjs`: process, network and
  service isolation negative contract.

No second manager, cron job, Android receiver, or Termux:Boot hook is
created. Termux:Boot already starts the existing
`service-daemon/runsvdir`; new services are discovered there.

## Physical quality and deployment matrix

| Gate | Status |
| --- | --- |
| Source and documentation committed on PocketHost main | DONE |
| Native shell/Node syntax and negative contract | OPEN |
| Stage services on actual Samsung with disabled markers | OPEN |
| Supervised start, HTTP 200 on loopback and private LAN | OPEN |
| Confirm protected external Termux services unchanged | OPEN |
| Verify healthwatch recovery on a controlled panel-only failure | OPEN |
| Reboot or Termux:Boot acceptance | OPEN |

Do not mark panel deployment PASS until a same-host task result and actual
HTTP/status samples verify it. Preserve the earlier checkout as rollback
and do not kill any external site or Local Agent service.
