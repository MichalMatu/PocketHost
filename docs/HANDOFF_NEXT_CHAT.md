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
- **Four exact-source code → deploy → verify passes** using A8-only `~/Projects/PocketHost-A8-QA`, guarded `ops/termux/fast-flow.mjs`, no test suites: `1234603ed7c356cb6c05f57aacfcf260e79e4f5b` → `cabff0d4697c0c4f2317a05913fd86bf4e1ac775` → `c0777b2397c13c3f758e927f9e39e69da3d36d41` → `8189e053ac54d1c029c97ebb9a9bd14bf16518e5` → **`b3222b1a81a07dfe1b1cfe4348913f899e4b8381`**. Last receipt `pockethost-a8-generic-host-cleanup-20261114-v1`: terminal **PASS**, actual live SHA `b3222b1a81a07dfe1b1cfe4348913f899e4b8381`, panel PID **28717**, loopback HTTP **200**, protected services unchanged, ~**16.41 GiB free** at observation. A new documentation-only commit may legitimately make GitHub `main` newer than this live release; do not infer the running revision from GitHub.
- **PocketHost service coordination is partially functional**: runit lifecycle controls and logs for explicitly registered services; panel/watch ownership; service inventory labels owned, enrolled, protected and unmanaged observations, including protected autostart markers. Services also now lists Node and static Hosting workloads through their existing APIs, shows Node desired vs. observed state and health policy, and offers explicit read-only HTTP readiness actions. **Feature-gated Hosting APIs are not automatically enabled**; activation and WAN/LAN mutation security require separate qualification. This does not claim all host services are enrolled. A8 `sshd` and `ssh-agent` remain **disabled/down** and protected from adoption.
- **A8 Local Agent** private git task/result transport is operational. Installed immutable bundle **`c39cd958c76cca0aaf2d30a654bdc4305c0a3228`**, runit PID **9023** at verification (`pockethost-a8-agent-bundle-identity-20261114-v1`). The newer Git result-index optimization source **`4d58ae544a1d7d73a6235e6b067152a605bb9635`** (single tree read instead of repeated subprocess lookups over >1200 retained results) is **not installed on A8**. Updating Local Agent requires separately qualified **independent external operator**, not self-restart/self-update through its own queue. No such operator update is part of this handoff.

## Project-agnostic cleanup (14 November 2026)

Commit `b3222b1` **removed 19 legacy app-specific runtime/UI files and tests**, including named app pages, legacy API imports/routes and the fixed host-service catalog. The Host snapshot now displays current device runit services dynamically. Known independent foreign services continue to be protected by **default non-PocketHost ownership** rather than customer-name exceptions. No hosted customer app, production site, service or data was changed. Historical project-specific ADRs/checkpoints remain available for audit only. **Tests were not run**, per owner rule; the A8 code → deploy → owner/SHA/HTTP readback passed.

The owner explicitly requires the product to remain **universal, with no hardcoded hosted projects**. Trusted private **LAN without a password** must be configurable within Network Access; SSH/GitHub and runit/autostart/health/rollback settings must also be configured within PocketHost rather than external hardcoded scripts. The existing Network Access UI has private interface selection and enable/disable, but A8 LAN reachability and reboot autostart are not yet acceptance-qualified. Per-service health-policy editing, complete SSH/GitHub settings and safe ownership enrollment are also incomplete. Do not imply that a read-only dashboard completes them.

## Product intent and next ordered actions

PocketHost is the **host desired-state coordinator**: enroll/own service definitions, installation and Git-based updates, autostart, per-service readiness/health policy, bounded restarts, logs, rollback and recovery. Official Termux `runit` remains the underlying process supervisor (do not create a duplicate supervisor or scheduler). SSH and Git are first-class host-management capabilities, but existing SSH and Local Agent require **separately verified ownership and recoverable access** before any control transfer. Discovery, an occupied port or a runit PID alone is never ownership.

1. Read [root AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [FAST FLOW](DEV_ITERATION.md), [architecture](ARCHITECTURE.md), nearest scoped AGENTS and fresh GitHub `main`; retrieve the **fresh** live A8 owner/SHA through the paired private task/result evidence. Do not assume source `main` equals deployed SHA, and never point to S22 QA paths.
2. Continue **M2–M3** using the project-agnostic **code → deploy → verify** A8 Local Agent flow. Prioritize in-panel desired-state settings for runit/Termux:Boot autostart, per-service health target and bounded restart policy; keep ServiceRegistry/ProjectRegistry typed, H2 static separate from Node, ownership fail-closed. Network Access must expose the actual trusted LAN interface, enablement and boot policy with loopback recovery; no password on trusted private LAN, **never WAN/public by default**. Do not weaken LAN mutation denial without a deliberately scoped authorization design. Prefer functionality over repeated audits.
3. Continue **M4–M5** with generic in-panel SSH configuration (key auth, ports and ownership), Git/GitHub connection/repository settings and credential protection, site/domain/HTTPS under separate approval, backup/restore and recovery. No domain, site name or customer app may be built into PocketHost. Do **not** expose unauthenticated DEV HTTP publicly or silently adopt external services.
4. Separately qualify autostart after an **owner-authorized** controlled reboot; it has not passed a real boot check. Any independent Local Agent update must use an accepted out-of-band rollback-capable operator, not the selected agent's own task queue.

Use the current verified A8 QA checkout, pin target `main` SHA, enforce live SHA/owner PID/start ticks/rollback/protected-service gates; invoke `ops/termux/fast-flow.mjs --base=<actual-live-sha> --target=<exact-main-sha> --apply` only for **product-code** updates. Require one terminal exact-SHA PASS. Unknown/pending/failed result = HOLD, no implicit retry. **Do not run tests, smoke, lint, typecheck, formatting or docs checks unless explicitly authorized.** Docs-only commits never trigger deployment or restart.

## Hard boundaries

- **A8 exclusively**: GitHub Connector + already paired private Local Agent; exact device IDs remain in private receipts. No Mac, Codex, Work, GitHub Actions, extra schedulers or unattended retries.
- No S22 cleanup, restore, installation, migration or production changes. No copy of S22 credentials, sites, process markers or old QA trees.
- No actions on independent PhotoMap/IleStoi/Cloudflare/SSH/MQTT/Local Agent services without separately qualified scope. Do not let panel loss eliminate the independent Agent recovery path.

**Current exit gate:** A8 installation PASS and FAST FLOW PASS; **remaining**: host-wide enrollment and lifecycle/health integration, M2–M5 features, physically verified autostart and separately scoped SSH/Agent administration.
