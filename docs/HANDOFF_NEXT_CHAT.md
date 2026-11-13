---
status: active
owner: core
last_reviewed: 2026-11-13
purpose: Compact, current PocketHost resumption contract; historical receipts stay in checkpoints and Git history
---

# PocketHost — Next Session

## Immediate owner-selected continuation — Termux service panels (2026-11-13)

The owner **deferred backups and Termux reset** and now prioritizes
working operator panels for the **already running services**, one by one,
over additional Node Hosting code. **Start implementation on IleStoi /
wreckscanner** in the existing Termux → Services screen. Then integrate
Cloudflare Tunnel, SSH/Mosquitto/healthwatch, and Local Agent/PocketHost.
For protected external services, begin read-only; stop/restart/config
requires a separate service-specific explicit authorization and verified
owner identity. Preserve Node Hosting source, historical QA, H2 and every
running service. No new menu, second runit supervisor or blanket adoption.

**Execution handoff:** [2026-11-13 service-panels checkpoint](checkpoints/2026-11-13-termux-service-panels-next-chat.md).
Read it before following the older Node-first plan below. Use fresh main
HEAD; do not assume this documentation commit is a phone deployment.

## Current source and work

Use the **fresh main HEAD**; never assume a checkpoint SHA. Work directly
on main with non-force, expected-HEAD updates. The active compact
entrypoint is [START_HERE](START_HERE.md), and local instructions
live in the nearest AGENTS.md.

**Active roadmap:** [Hosting-first Basic/Pro and two P0 tracks](ROADMAP.md).
Basic is the fully functional official-Termux product (Node.js, GitHub,
Cloudflare, SSH, per-site traffic analytics, backup). Pro is a
technical category for functions needing extra Android apps/permissions,
not a price tier. **Do not change the menu now.**
Freeze Companion/Shizuku code without deleting it. **After the current
service-dashboards sprint**, resume these prior product tasks:
(1) finish owned Node.js Hosting + GitHub import/update/rollback;
(2) integrate Hosting panel Cloudflare/domains/SSH/web analytics/backup.

**Deferred only:** [ADR-0017 unified Android APK](adr/0017-termux-first-single-app-integration.md).
I0–I4, Android app packaging and Companion expansion are *not* the
next implementation steps. Historical standalone S1 probe stays retired;
the active installed Termux and protected services remain unchanged.

PocketHost is a **DEV-only Android/Termux management console**.
H2 owned static hosting, Termux administration, read-only observations,
Shizuku integration and browser-owner shell controls have source/history.
The approved target is a modular platform with Hosting as the
orchestrator, not a right to import or control existing Termux sites.

M0 Hosting/System separation, PhotoMap diagnostics isolation and generic
external-service catalog are implemented as source changes.
M1 versioned declarations, one private host-owned registry store,
ownership diagnostics, rollback planning and restore protections have
focused negative tests. **This does not activate migrations, managed
services, new process control or public routes.** M2/M3 source candidates exist for owned lifecycle, staging and
runit; disposable physical Node Hosting acceptance remains OPEN.

## Current release candidate and acceptance — 2026-11-13

Code source checkpoint before this documentation update:
`b7c8caffd8713b42334e991e5dd9df7e7b2e4043`. Re-fetch main HEAD on entry;
the checkpoint SHA is **not** a claim about installed Samsung panel source.

Node project UI now contains GitHub pinned-commit import, bounded local
folder selection, text files and binary frontend assets, dependency/build
review, read-only rollback review and explicit deployment actions.
Source+runtime are **not certified live** at the current SHA.

Native Samsung receipts: at older `40a8513`, 61/61 Node tests and focused
UI passed, while TypeScript failed; source type fixes were committed later.
At `631ed7c`, 40/42 native tests passed, and the two assertion mismatches
were corrected at `602123d`; no newer terminal PASS may be inferred.
Local-folder UI and import-closeout checks are **queued / terminal result
missing**. Current source exact-SHA native QA, installed DEV panel source
identity, visual review and disposable physical Node lifecycle remain **HOLD**.
Historical full G2 and H2 static Hosting evidence is unchanged.

See [current Node panel checkpoint](checkpoints/2026-11-13-node-panel-preview-handoff.md)
for the bounded evidence, browser path and next acceptance gates.

## Deferred Node Hosting acceptance steps (after service panels)

1. Verify current `main`, then read the two pending focused Samsung receipts
   (local folder UI and exact-source import/typecheck). If unavailable, stay
   HOLD; do not duplicate the queued tasks. Fix only a confirmed regression.
2. **Show the owner the actual `/projects` panel.** Historical trusted-LAN
   admin URL: `http://192.168.0.100:18878/projects` (not current-verified).
   Read-only check the existing panel owner, process, checkout SHA, feature
   flags and HTTP route. Compare deployed SHA to latest main. Backend/config
   changes mandate reviewed PocketHost-only sync; prefer existing Vite HMR
   for UI; do not start a second panel or touch foreign services.
3. After native QA and verified panel-only sync, obtain one actual browser
   screenshot and owner acceptance of `/projects`: GitHub/folder import,
   staged source/asset list, build/rollback review and feature-disabled states.
   A screenshot is evidence of UI, **not** Node G3 runtime acceptance.
4. Only after explicit approval, perform a **disposable user-owned** Node
   GitHub → dependencies → build → start → readiness → update → rollback
   lifecycle. Then continue Hosting Cloudflare/SSH/analytics/backup per ROADMAP.
   Do not treat source proof as a working deployed application.

## Preserved boundaries

Only the exact owner-verified PocketHost DEV panel may use its
approved runit restart/watchdog. The private-LAN UI and Android
loopback Companion are not WAN-safe. Protect IleStoi, PhotoMap, SSH,
Cloudflare, Local Agent, existing sites, packages and data. A
discovered PID, port or runit name never proves ownership. No
GitHub Actions, Codex, Work or non-Termux PocketHost execution.

## Canonical pointers

- [Quality gates and precise PASS semantics](QUALITY_GATES.md)
- [Canonical current Hosting-first delivery sequence](ROADMAP.md)
- [Deferred one-APK integration option](adr/0017-termux-first-single-app-integration.md)
- [Code ownership and test map](CODE_MAP.md)
- [Termux host-command transport](LOCAL_AGENT_TERMUX.md)
- [Recent M0/M1 source and evidence checkpoint](checkpoints/2026-11-09-m0-m1-ownership-and-canonical-style.md)
- [Full M0/M1 checkpoint](checkpoints/2026-11-09-m0-m1-complete-checkpoint-next-chat.md)
- [Historical checkpoint archive](checkpoints/README.md)

The full pre-cleanup handoff remains in Git history at
commit 685daea477ab5e4de63e8bd99bf20c10c7647bd9;
it is **not** the active entrypoint.
