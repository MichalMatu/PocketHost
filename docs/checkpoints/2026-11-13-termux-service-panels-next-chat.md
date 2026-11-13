---
status: active-handoff
owner: hosting
last_reviewed: 2026-11-13
purpose: Owner-approved change of next sprint priority to actual Termux service dashboards
---

# PocketHost — existing Termux services: next-chat execution handoff

## Owner decision

STOP another broad audit and do NOT reset or clean Termux; defer full-system
backup for now. Deliver visible, real, useful per-service panels **sequentially**
in the existing PocketHost web console. Preserve running services, existing
runit and the current navigation. One complete vertical slice at a time:
read-only real data → focused Samsung tests → owner screenshot/review →
optional separately approved lifecycle operations. Do **actual implementation
and GitHub commits**, not just a plan/checkpoint. Resume development on main.

## Fresh source and verified facts

- Source `main` at handoff start: `2893caff69b12bc6de7f08dfe2813401586b985e`.
  This is historical only; read the fresh HEAD before any change.
- Real prior private-LAN panel: `http://192.168.0.100:18878/` with
  `/projects`; IP/reachability must be rechecked and no public access
  implied. Browser screenshots showed Node Hosting disabled on deployed
  DEV panel while status views rendered. Historical screenshot is not
  proof of the latest source.
- Samsung focused QA at `2893caf`: 7/7 local-folder reader tests,
  35/35 Node projects interaction tests, and root/admin/Vite TypeScript
  checks PASS. Backend Node source/GitHub/build tests: 42/42 PASS on
  older `2b285fd`; these are separate exact-SHA scopes, not physical G3.
- Last trustworthy live-owner read-only result: panel's
  `/projects` reachable (HTTP 200 on loopback and trusted LAN);
  positively matched process PID/start ticks and cwd; clean checkout
  `9c484d7afc44d3114cf971c1d3d55b31b693d907`, but owner marker
  sourceSha `8d66d24224e87043ad1a56ebcfa94619befea839`.
  **Version/owner marker mismatch remains unresolved**. Do not
  rewrite markers, assume checkout equals running code or blindly
  restart/sync the panel. Node feature flags in process env were not
  present in that readout.
- The follow-up live-source-delta Local Agent diagnostic task
  `pockethost-panel-live-source-delta-20261113-v1` **FAILED before
  execution**, due to malformed heredoc closing in the task, not due to
  a phone runtime error. Do not reuse the malformed command.
- Prior owner-facing Host screen showed existing services active.
  Inspect actual current inventory afresh before any operator controls.
- Existing module `src/modules/host/termux-service-admin.ts` already
  implements runit discovery/state/autostart and user-registered
  lifecycle controls. Its protected-service denylist includes
  `wreckscanner`, `wreckscanner-backup`, `cloudflared`,
  `sshd`, `mosquitto`, `ilestoi-healthwatch`,
  `termux-agent`, `pockethost-panel` and
  `pockethost-panel-watch`. **Do not remove this guard to create
  buttons.** `src/modules/host/observed-service-catalog.ts` maps
  generic read-only six-card observations, not ownership.
- Existing UI: `apps/admin/src/app/termux/page.tsx`, subsection
  `Services`, using `RunitServiceActions` in
  `apps/admin/src/app/termux/admin-actions.tsx`. The termux service
  inventory and generic monitoring list are already present; avoid
  duplicating the section or moving the menu.
- Typed Vite DEV API adapter: `apps/admin/vite.config.ts`.
  Read with small line ranges. Preserve Origin/intent enforcement
  and keep all secret values out of JSON and logs.

## Concrete delivery sequence (one usable vertical slice per sprint)

### S1 — IleStoi / wreckscanner: FIRST

Implement a dedicated read-only diagnostic card in existing Termux Services
using the already observed, fixed known runit service name. Display
real state, uptime/verified identity where accessible, host RSS/process
memory (or explicit `unavailable` if /proc is restricted), bounded
redacted service logs and last observation/error, and an actual HTTP
health probe **only if its known route is verified**. No invented uptime,
memory or endpoint. Prefer shared host adapter and typed DTO, with
bounded timeouts, exact-target checks, no arbitrary path/PID input.
A running process name or port is not proof of control authority.
Keep start/restart/stop disabled, with UI explaining why. If logs or
a health route are inaccessible, show the limitation instead of failing
the entire card. Add positive/negative host tests for spoofed names,
symlinks, unavailable /proc, timeouts and redaction; focused admin UI
tests for availability/error states. Commit on main, run only affected
Samsung Local Agent checks, then show a real owner-visible screen.
Do not touch `wreckscanner` or `wreckscanner-backup` processes.

### S2 — Cloudflare Tunnel

Show runit state, read-only connector/connection diagnostics, safe
domain-routing summaries from an authorized known config, failure state
and bounded/redacted logs; never expose certs, tokens, API credentials
or full sensitive configuration. Don't change DNS, credentials, tunnel
configuration or Cloudflare processes. No speculative tunnel health
claims without a verified observation.

### S3 — SSH, Mosquitto, IleStoi healthwatch

Add focused per-service cards (reuse common UI and typed backend):
runit state, available operational health, bounded diagnostic logs,
safe read-only configuration summary. Respect each service's actual
privileges, sensitive secrets and missing system metrics. No service
signal, package install or config write. For healthwatch include
observable last check only if independently available.

### S4 — Local Agent and PocketHost

Show Local Agent health/intake/last result from existing supported
sources without changing its worker registration. Show PocketHost
running PID/start-ticks, owner marker and checkout SHA **side-by-side**,
with explicit mismatch state, update readiness and required rollback
guards. No self-restart until precise ownership and revision drift are
resolved. Do not accidentally kill the only remote management channel.

### S5 — gated operations, only after explicit new owner permission

For each service independently: positively verify canonical runit
registration, owner record, observed process identity and rollback.
Add deliberate start/stop/restart/maintenance/config controls only to
that *separately authorized* service. Do not convert all protected
services to managed by name, PID, port or a blanket approval.
Write gates need separate state/intent validation and failure receipts.

## Next session: first 6 actions

1. Read `AGENTS.md`, `docs/START_HERE.md`, this checkpoint and the
   nearest scoped instructions; fetch **fresh main HEAD**.
2. Read only needed service UI/host files, host evidence and pending
   Local Agent tasks, avoiding new broad audits or duplicate QA.
3. Design the smallest read-only IleStoi card using existing UI and
   typed host facade; inspect supported observability signals before
   choosing endpoint/uptime/memory assumptions.
4. **Implement** S1 with a focused negative host test and UI test;
   commit code to current main. Do not merely write more docs.
5. Execute only affected tests through the exact verified Samsung
   Termux Local Agent; confirm terminal receipt. No Mac/sandbox,
   Codex, Work or GitHub Actions. Avoid any production process mutation.
6. If passing, use approved existing Vite HMR or separately guarded
   PocketHost-only sync (no forced restarts) and request actual owner
   screenshot. If panel owner SHA mismatch persists, document it,
   leave live panel unchanged, but continue completing the source UI.

## Safety and completion criteria

- No whole-Termux backup/reset/reinstallation at this stage; owner
  postponed backup. Never clean other service directories.
- Never start another Vite panel, another runit supervisor or another
  Local Agent. Protect SSH, MQTT, Cloudflare, IleStoi/PhotoMap,
  all site workloads and the host management plane.
- The currently trusted LAN panel is DEV-only without public auth.
  Never expose it on WAN, add a public tunnel, or claim it is secured.
- Acceptance of S1: real diagnostic data present or explicitly unknown,
  bounded redacted failures handled, no foreign service mutations,
  focused Samsung tests PASS at exact SHA, and actual owner browser review.
  A GitHub commit alone does not prove live deployment.
- Resume Node Hosting and broader Cloudflare/SSH hosting management
  after these owner-prioritized service panels (ROADMAP); do not erase
  completed Node work.

