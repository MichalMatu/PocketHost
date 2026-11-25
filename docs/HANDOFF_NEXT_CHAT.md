---
status: active
owner: core
last_reviewed: 2026-11-25
purpose: V1 source acceptance, deploy boundary and safe future resume
---

# PocketHost — v1 handoff

- **Source:** `MichalMatu/PocketHost` `main`; G2-qualified runtime source `d2bacd081ad0879d49a08e3c7fd97789185ad6e4`.
- **G0–G2:** terminal `QA_PASS` on the paired Samsung A8 for `pockethost-a8-g2-final-core-d2bacd0-20261123-v1` and `pockethost-a8-g2-final-allui-d2bacd0-20261123-v1`. Historical UI run reported **486/486 tests**; the former Vitest filter excluded two TSX files (corrected in Sprint 4F). Node **469 PASS, 1 SKIP**, line coverage **76.11%**; structure, docs, boundaries, budgets, Markdown, Prettier, root/admin lint, root/admin types and Vite build passed. The one hardlink scenario was skipped due to the Android filesystem. The two admin lint warnings were not blocking.
- **Last device-attested DEV release:** `baeacfbc127f8c679bc6e2ee886bb4fe199edb70`, `pockethost-a8-s7-deploy-baeacfb-20261125-v1` PASS (HTTP 200, protected services/dependencies unchanged). S7 exact QA, 191/191 mapped UI tests, build and isolated starter fixtures PASS. Sprints 1–7 closed; development frozen by owner; see [quality gates](QUALITY_GATES.md).
- **Browser UX:** owner reported acceptance of the current MVP (not an additional automated test receipt).

## Previously verified physical recovery and owned workflows

- Encrypted Node Restic backup/restore: `pockethost-a8-restic-node-backup-isolated-restore-20261117-v1` contains a nested **PASS** for one local snapshot and independent staging restoration of 10 owned files. Its outer postflight held on an overly strict unrelated Static inventory comparison.
- Independent read-only postflight `pockethost-a8-restic-postflight-owned-inventory-20261117-v1` was terminal **PASS** and confirmed 10 matching restored files, healthy Node and Static releases and untouched protected services.
- S1–S4 fixed owned worker lifecycle (create, start, health/logs, stop, archive, restore, retire) passed under `pockethost-a8-s1-s4-complete-owned-flow-396058d2-20261116-v1`.
- These are **scoped physical acceptance tests**, not an attested restore after loss of the A8 or independent off-device credential recovery.

## Resume discipline

The v1.0.0 source baseline remains frozen; the owner resumed post-v1 development on 24 November. The tag marks source, not a fresh A8 deploy. Do not resume the old night feature queue or repeat passed G2 solely because older documents show its earlier failures. The immutable N12 task `pockethost-a8-night-n12-dde5a04-qa-20261122-v1` is still UNKNOWN; do not replay it.

If later editing runtime code, first obtain fresh `main` and real A8 live SHA, run only approved non-destructive exact-SHA QA via the paired A8 Local Agent, and separately guarded-deploy/read back the new revision. Docs-only edits: Git commit only, no A8 build, test, service restart or deployment. Never use GitHub Actions, Codex or Work.

[Sprint 4](ROADMAP.md) closed: server adapters, runtime helper split, strict types, syntax-aware browser boundary and backup-session invalidation. Sprint 3 evidence: snapshot median 560.61 to 119.90 ms (-78.6%), 15/15 HTTP 200; static RSS and built UI experiments do not establish equivalent independent lifecycle or API/render behavior. See architecture. Public exposure, physical reboot, extended device endurance and off-device recovery remain separately scoped. Sprint 5 traffic analytics is deployed; existing Static and Node applications were not restarted, and their live snapshots are missing until their normal next start. Collection was proven in isolated real HTTP fixtures. Sprint 6 read-only SQLite Studio is deployed and qualified on isolated fixtures; no real application database was used for acceptance. WAL SHM coordination may change. Sprint 7 Application Starters is deployed. The remaining frozen S8–S12 backlog is recorded in [upstream reuse](UPSTREAM_REUSE_STRATEGY.md) and [roadmap](ROADMAP.md).

## Owner's next visit

**PAUSED / FROZEN.** Owner requested stopping after full S7 closure. S8–S12 are not started; no pending A8 tasks at freeze verification. Do not resume automatically, including from the old night-sprint backlog. On explicit owner instruction, read fresh main and independently verify live SHA, inspect the queue, and select the next narrowly scoped work; do not repeat passed sprints. Preserve Git history and immutable A8 receipts. No new sprint, QA or deployment is implied by this documentation-only commit.
