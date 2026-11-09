---
status: accepted-with-follow-up
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

## Diagnosed outage and accepted initial activation (2026-11-09)

Samsung Termux runit is healthy: the existing service manager did not
initially notice freshly staged PocketHost services in time for an
immediate `sv-enable`. The installer returned
`unable to open supervise/ok`, left both new services safely disabled,
and did not change any existing services.

Mac Local Agent verified S22 SSH (8022) was reachable but PocketHost
LAN (18878/18879) was not listening. Later independent Mac SSH diagnostics
proved `runsvdir` had adopted both registrations and created their
`supervise/ok` FIFOs. A guarded retry of **activate only** then returned
**PASS**:

- `pockethost-panel` `run`, first verified PID 15757.
- `pockethost-panel-watch` `run`, PID 16103.
- `http://127.0.0.1:8787/shizuku` HTTP 200.
- `http://192.168.0.100:18878/shizuku` HTTP 200.
- All six protected services (sshd, cloudflared, wreckscanner,
  mosquitto, ilestoi-healthwatch and termux-agent) remained `run`.

Source `ops/termux/install-panel-services.sh` now waits for two
supervise FIFOs and responsive `sv status` before enabling; the
negative contract was extended to cover this regression. This later
source change is committed but is not retroactively included in the
already running panel checkout.

Exact private host results:
`pockethost-panel-native-guarded-runit-install-20261109-gpt6-v1`
(initial safe HOLD), followed by Mac host task
`pockethost-panel-activate-after-runsvdir-20261109-v1` (PASS).

Samsung source gate on `2d9cab21` passed shell and Node syntax,
3/3 focused negative tests, but the broad `check:structure` gate
failed on pre-existing source layout allowlist entries (`native`,
`ops`, `shizuku` and several `.mjs` files). Do not classify the
whole repository gate as PASS.

## Physical quality and deployment matrix

| Gate | Status |
| --- | --- |
| Source and documentation committed on PocketHost main | DONE |
| Native shell/Node syntax and negative contract | PASS at 2d9cab21 (3/3); later installer race fix needs retest |
| Stage services on actual Samsung with disabled markers | PASS |
| Supervised start, HTTP 200 on loopback and private LAN | PASS |
| Confirm protected external Termux services unchanged | PASS |
| Verify healthwatch recovery on a controlled panel-only failure | OPEN |
| Reboot or Termux:Boot acceptance | OPEN |

Do not mark panel deployment PASS until a same-host task result and actual
HTTP/status samples verify it. Preserve the earlier checkout as rollback
and do not kill any external site or Local Agent service.
