---
status: active
owner: core
last_reviewed: 2026-11-09
purpose: Compact, current PocketHost resumption contract; historical receipts stay in checkpoints and Git history
---

# PocketHost — Next Session

## Current source and work

Use the **fresh main HEAD**; never assume a checkpoint SHA. Work directly
on main with non-force, expected-HEAD updates. The active compact
entrypoint is [START_HERE](START_HERE.md), and local instructions
live in the nearest AGENTS.md.

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
services, new process control or public routes.** M2 shared lifecycle
and M3 disposable Node Hosting remain future work.

## Evidence snapshot, not a fresh PASS

Historical exact-SHA Samsung receipts include 196/196 Node tests in
earlier M0 runs, 55/55 UI tests at 0f5291d7, and focused M1 negative
tests at 9fb7db9, 22245f13 and 4fa08631. They certify only those
revisions/scopes. The later 9b478177 focused docs/format task passed
the Markdown gate but failed on one Prettier warning in
tests/quality/hosting-registry-restore.test.mjs. Read its actual
terminal result before scheduling more work.

The 2026-11-09 documentation/performance commits **685daea and later**
have no confirmed exact-SHA Samsung acceptance in this handoff.
Final current-source G1/G2 and physical G3 therefore remain **OPEN**.
Earlier PocketHost-only panel runit/LAN acceptance is historical, not
proof that today's main is installed. Do not infer task completion
from publication, cached notes or a commit.

## First actions

1. Check fresh PocketHost main and, only if native execution is needed,
   the **actual private Local Agent** host/installation and pending
   task receipts. Do not re-enroll the project or replay settled tests.
2. Use the last verified source SHA as the base of the
   [change-aware plan](DEV_ITERATION.md): run only affected Node/Vitest,
   lint/format and incremental typechecks through Samsung Termux Agent.
   For unmapped/host-sensitive files, manually select the negative tests.
3. For docs-only edits: docs link/index, Markdownlint and formatting,
   without frontend rebuild, service restart or physical gate.
   UI-only edits: HMR on the existing verified PocketHost panel.
4. When genuinely closing M0/M1, collect only missing exact-final-SHA
   source and disposable physical evidence. Separate that from M2/M3
   implementation. Never promote historical PASS to a new SHA.
5. Record a **short status delta**, task ID, tested SHA, commands/exit
   codes and remaining risk in one relevant checkpoint. Do not append
   another chronological transcript to this file.

## Preserved boundaries

Only the exact owner-verified PocketHost DEV panel may use its
approved runit restart/watchdog. The private-LAN UI and Android
loopback Companion are not WAN-safe. Protect IleStoi, PhotoMap, SSH,
Cloudflare, Local Agent, existing sites, packages and data. A
discovered PID, port or runit name never proves ownership. No
GitHub Actions, Codex, Work or non-Termux PocketHost execution.

## Canonical pointers

- [Quality gates and precise PASS semantics](QUALITY_GATES.md)
- [Current delivery sequence](ROADMAP.md)
- [Code ownership and test map](CODE_MAP.md)
- [Termux host-command transport](LOCAL_AGENT_TERMUX.md)
- [Recent M0/M1 source and evidence checkpoint](checkpoints/2026-11-09-m0-m1-ownership-and-canonical-style.md)
- [Full M0/M1 checkpoint](checkpoints/2026-11-09-m0-m1-complete-checkpoint-next-chat.md)
- [Historical checkpoint archive](checkpoints/README.md)

The full pre-cleanup handoff remains in Git history at
commit 685daea477ab5e4de63e8bd99bf20c10c7647bd9;
it is **not** the active entrypoint.
