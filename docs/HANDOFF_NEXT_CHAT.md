---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: A8 installed — continue PocketHost service coordination and Hosting M2–M5
---

# PocketHost — Galaxy A8 next session

**Target: the already-paired Galaxy A8 only.** PocketHost on S22 is retired; S22 continues its independent production IleStoi, SSH, Cloudflare and MQTT services. Do not touch S22 or its retained worktrees/sites. Production PhotoMap remains independently on Pi Zero 2 W. Historic retirement details: [closed S22 checkpoint](checkpoints/2026-11-14-s22-retired-a8-bootstrap-handoff.md) and [final cross-device checkpoint](checkpoints/2026-11-14-final-s22-reaudit-a8-local-agent-handoff.md).

## Verified A8 baseline — 14 November 2026

- **A8 cold bootstrap PASS**: clean official Termux package upgrade, Node.js **v24.22.3**, standalone npm **12.2.2**, Git **2.56.1**, Python **3.14.10**, isolated `~/Projects/PocketHost-A8-DEV`, A8-owned markers, runit panel and watchdog, source/PID/start ticks and loopback HTTP 200. Private receipt `pockethost-a8-cold-bootstrap-20261114-v3`. Standard runit started under its own supervisor and a dedicated Termux:Boot hook configured; **no reboot/autostart acceptance has been performed**.
- **Guarded A8 code → deploy → verify** ran repeatedly using the clean A8 QA checkout and `ops/termux/fast-flow.mjs`, without test suites. Latest changes: `328f13191416fe5ba8d95a2cc12ccc306a77260d` → `b4da49ef9b80affe76a563315c584934ce42430b` → `291a5ff3f1713021e251cb0865cb6f84d481f1ad`. Latest code chain: `7c19c3d` → `2c2b4e3` → `839c397` → `10f469d` → `0047af4a455c799086cc5f708b6add8d60462e56` → **`b975d1feb7011d24bd592aadc55e1a30d54a0e90`**. Last A8 guarded task `pockethost-a8-worker-heartbeat-policy-20261115-v1`: terminal **PASS**, live SHA **`b975d1feb7011d24bd592aadc55e1a30d54a0e90`**, panel PID **27534**, loopback HTTP **200**, protected services unchanged, **16.32 GiB free**, `tests=not-run`. S4 now supports per-instance persisted worker heartbeat threshold Off/3/5/10 minutes: on-demand, fixed `svlogd -tt` last-line validation plus trusted mtime, not HTTP/application readiness. No scheduler, no autostart or protected-service modifications. Prior A8 receipts cover S1/S2 archive/restore, S3 persisted autostart, S4 read-only inspection/manual bounded recovery. **S1–S4 remain IN_PROGRESS** pending stage tests and broader readiness/rollback/Termux:Boot qualification. Docs-only commits can advance Git `main` without changing the live A8 SHA.

- **PocketHost service coordination is partially functional**: runit lifecycle controls and logs for explicitly registered services; panel/watch ownership; service inventory labels owned, enrolled, protected and unmanaged observations, including protected autostart markers. Services also now lists Node and static Hosting workloads through their existing APIs, shows Node desired vs. observed state and health policy, and offers explicit read-only HTTP readiness actions. **Feature-gated Hosting APIs are not automatically enabled**; activation and WAN/LAN mutation security require separate qualification. This does not claim all host services are enrolled. A8 `sshd` and `ssh-agent` remain **disabled/down** and protected from adoption.
- **A8 Local Agent** private git task/result transport is operational. Installed immutable bundle **`c39cd958c76cca0aaf2d30a654bdc4305c0a3228`**, runit PID **9023** at verification (`pockethost-a8-agent-bundle-identity-20261114-v1`). The newer Git result-index optimization source **`4d58ae544a1d7d73a6235e6b067152a605bb9635`** (single tree read instead of repeated subprocess lookups over >1200 retained results) is **not installed on A8**. Updating Local Agent requires separately qualified **independent external operator**, not self-restart/self-update through its own queue. No such operator update is part of this handoff.

## Project-agnostic cleanup (14 November 2026)

Commit `b3222b1` **removed 19 legacy app-specific runtime/UI files and tests**, including named app pages, legacy API imports/routes and the fixed host-service catalog. The Host snapshot now displays current device runit services dynamically. Known independent foreign services continue to be protected by **default non-PocketHost ownership** rather than customer-name exceptions. No hosted customer app, production site, service or data was changed. Historical project-specific ADRs/checkpoints remain available for audit only. **Tests were not run**, per owner rule; the A8 code → deploy → owner/SHA/HTTP readback passed.

The owner explicitly requires the product to remain **universal, with no hardcoded hosted projects**. Trusted private **LAN without a password** must be configurable within Network Access; SSH/GitHub and runit/autostart/health/rollback settings must also be configured within PocketHost rather than external hardcoded scripts. The existing Network Access UI has private interface selection and enable/disable. A8 LAN gateway returned `healthy` on Wi-Fi with HTTP 200, and the owner opened the panel from MacBook and approved the navigation (2026-11-14). **Reboot autostart is not yet acceptance-qualified**. Per-service health-policy editing, complete SSH/GitHub settings and safe ownership enrollment are also incomplete. Do not imply that a read-only dashboard completes them.

## Services information architecture (14 November 2026)

The owner requires **separate menu destinations and separate components**, not a single full-page Services console. Commit `2f53ec3` implements `/services` as a lightweight links-only overview. Independent, code-split routes now provide **Runit services**, **Autostart**, **Hosting workloads**, **Health checks**, and existing **Local Agent**, **SSH**, **Cloudflare Tunnel** and **MQTT** pages. Legacy Services content was removed from the shared Termux screen. Runit component is scoped to lifecycle actions or autostart operations by explicit mode. Hosting inventory and manual HTTP readiness are independent views with no background health polling. Do not merge them back into one page; keep feature settings adjacent to their relevant module and add future SSH/GitHub configuration as dedicated panels rather than fake sample toggles.

No service registration, SSH setting, boot setting, Git credential or hosted project was changed. Termux:Boot after a real device restart and full configurable health/SSH/GitHub settings remain unverified/incomplete. This deployment only verified exact source SHA, panel owner identity, runit isolation and loopback HTTP health, **not functional UI tests**.

## Ordered MVP delivery contract — owner-approved 14 November 2026

**Mandatory source of truth: [MVP execution plan](MVP_EXECUTION_PLAN.md).** The owner chose **finish existing partially implemented workflows**, not build more skeletons. Follow in order, without skipping:

1. **Services** — first S1: universal verified enrollment and lifecycle ownership; then safe Start/Stop/Restart/logs, autostart, readiness and bounded recovery, tests and acceptance.
2. **Platform** — LAN settings, boot policy (physical reboot separately authorized), SSH and Git/GitHub, scoped safety tests and acceptance.
3. **Hosting** — separate Node/static import/build/deploy/run/health/logs/update/rollback, tests and acceptance.
4. **Stabilization** — cleanup, backups/recovery, security, focused end-to-end regression and acceptance.

At the completion of **each whole stage**, the owner **explicitly authorized targeted tests** with the existing A8 QA/test gate. Interim implementation slices remain no-tests by default. Test positive/negative permissions and functional flows, write actual PASS/FAIL/SKIP and coverage gaps, safely refresh the **PocketHost-owned** A8 panel, verify exact live SHA/PID/start ticks/local HTTP/private LAN and provide MacBook access + a concise report. Track READY_FOR_ACCEPTANCE until the user confirms; only then mark ACCEPTED and check off the complete stage. Full device reboot, external SSH/process changes, WAN and other disruptive actions still require a separate specific consent.

Continue from S1, using fresh live A8 identity/revision on every code update. One exact pinned `main` commit and one guarded A8 Local Agent FAST FLOW task per ordinary code iteration; do not repeat audits or automatically retry. Docs-only updates never run tests or restart the panel. Preserved framework/CMS examples remain accessible at the bottom of the sidebar; do not remove them.

## Hard boundaries

- **A8 exclusively**: GitHub Connector + already paired private Local Agent; exact device IDs remain in private receipts. No Mac, Codex, Work, GitHub Actions, extra schedulers or unattended retries.
- No S22 cleanup, restore, installation, migration or production changes. No copy of S22 credentials, sites, process markers or old QA trees.
- No actions on independent PhotoMap/IleStoi/Cloudflare/SSH/MQTT/Local Agent services without separately qualified scope. Do not let panel loss eliminate the independent Agent recovery path.

**Current exit gate:** A8 MacBook LAN/menu baseline ACCEPTED; **no MVP stage 1–4 yet fully accepted**. Continue S1; tests and owner handoff are mandatory at completed-stage closure. Reboot and protected external service changes remain separately gated.
