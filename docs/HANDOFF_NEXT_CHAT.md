---
status: active
owner: core
last_reviewed: 2026-11-12
purpose: Compact, current PocketHost resumption contract; historical receipts stay in checkpoints and Git history
---

# PocketHost — Next Session

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
Freeze Companion/Shizuku code without deleting it. Current tasks:
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
services, new process control or public routes.** M2/M3 source candidates exist for owned lifecycle, staging and runit; disposable
physical Node Hosting acceptance remains OPEN for the next chat.

## Current evidence — scope-specific PASS

On 2026-11-11, Samsung `npm run check:all` completed **G2 PASS**
on source `bba2d625269fed249aa88d4e180450ec0e071459`:
282/282 Node tests and 111/111 admin UI tests. The same task
owner-verified and refreshed **only PocketHost DEV panel** from
`504df7a` to `bba2d62`; protected external services were unchanged.
First loopback route sweep passed 12/13; `/terminal` required a
read-only follow-up. **Do not infer physical G3 PASS.**

See the [2026-11-11 exact-SHA closeout and Hosting handoff](checkpoints/2026-11-11-system-ux-closeout-hosting-handoff.md) for task ID,
acceptance scope and remaining follow-up. A later docs-only commit does not
change the tested app source or re-certify a new source SHA.

## Current System UX follow-up (2026-11-12)

The nine-screen read-only source review, focused UI fixes, screenshot
attempts and exact-SHA test holds are tracked in the
[2026-11-12 System screenshot and UX checkpoint](checkpoints/2026-11-12-system-nine-screen-ux-source-audit.md).
Do not repeat the 2026-11-11 full G2: earlier PASS belongs to its tested SHA.
Capture/device acceptance and deployment are separate from source commits.

## 2026-11-12 repository repair continuation

Package view reset, backend protection for the PocketHost panel/watchdog
and truthful package-refresh status are committed as source repairs.
See the [repair checkpoint](checkpoints/2026-11-12-general-repository-repair-continuation.md).
Current-source Samsung gates, live panel update and G3 remain OPEN.
A previously published scoped Agent task has no accepted terminal
receipt yet; do not reuse its old-SHA result as a PASS.

## First actions

1. Verify fresh main, current repair/test receipts and the real
   Samsung Local Agent state before sending any task. Do not replay
   already accepted tests or mistake published tasks for PASS.
2. Continue **P0 Node.js + GitHub** using existing M1–M3 source
   and runit adapter: disposable create/import, dependency plan,
   owned start/readiness/logs, update and rollback. Obtain exact-SHA
   Samsung tests and separate physical acceptance.
3. Then continue **P0 Hosting integrations**: Cloudflare/domain/HTTPS,
   SSH, per-site web analytics (not Android RX/TX), file/terminal and
   Restic backup/restore. Never adopt observed foreign services.
4. For docs-only edits run only relevant links/Markdown/format checks
   on Samsung when available; do not build/restart the panel.
   Preserve exact source receipts and OPEN/HOLD outcomes in a
   relevant checkpoint rather than duplicating status in this file.

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
