---
status: active
owner: core
last_reviewed: 2026-11-24
purpose: V1 source acceptance, deploy boundary and safe future resume
---

# PocketHost — v1 handoff

- **Source:** `MichalMatu/PocketHost` `main`; G2-qualified runtime source `d2bacd081ad0879d49a08e3c7fd97789185ad6e4`.
- **G0–G2:** terminal `QA_PASS` on the paired Samsung A8 for `pockethost-a8-g2-final-core-d2bacd0-20261123-v1` and `pockethost-a8-g2-final-allui-d2bacd0-20261123-v1`. All 77 UI test files, **486/486 assertions** passed; Node **469 PASS, 1 SKIP**, line coverage **76.11%**; structure, docs, boundaries, budgets, Markdown, Prettier, root/admin lint, root/admin types and Vite build passed. The one hardlink scenario was skipped due to the Android filesystem. The two admin lint warnings were not blocking.
- **Last device-attested DEV release:** `120adca4fcb9ee4cc089b58994bc0a87ca35f583`, receipt `pockethost-a8-static-removal-deploy-120adca-20261124-v1` (HTTP 200, owned PID/ticks, protected services unchanged). Separate exact-source changed QA `pockethost-a8-static-removal-qa-120adca-20261124-v1` PASS (12/12 checks plus code budgets). Sprint 1 closed: edge-case QA `pockethost-a8-static-edge-qa-bf671cf-20261124-v1` PASS (4/4 checks) at `bf671cf`; no further runtime changes.
- **Browser UX:** owner reported acceptance of the current MVP (not an additional automated test receipt).

## Previously verified physical recovery and owned workflows

- Encrypted Node Restic backup/restore: `pockethost-a8-restic-node-backup-isolated-restore-20261117-v1` contains a nested **PASS** for one local snapshot and independent staging restoration of 10 owned files. Its outer postflight held on an overly strict unrelated Static inventory comparison.
- Independent read-only postflight `pockethost-a8-restic-postflight-owned-inventory-20261117-v1` was terminal **PASS** and confirmed 10 matching restored files, healthy Node and Static releases and untouched protected services.
- S1–S4 fixed owned worker lifecycle (create, start, health/logs, stop, archive, restore, retire) passed under `pockethost-a8-s1-s4-complete-owned-flow-396058d2-20261116-v1`.
- These are **scoped physical acceptance tests**, not an attested restore after loss of the A8 or independent off-device credential recovery.

## Resume discipline

The v1.0.0 source baseline remains frozen; the owner resumed post-v1 development on 24 November. The tag marks source, not a fresh A8 deploy. Do not resume the old night feature queue or repeat passed G2 solely because older documents show its earlier failures. The immutable N12 task `pockethost-a8-night-n12-dde5a04-qa-20261122-v1` is still UNKNOWN; do not replay it.

If later editing runtime code, first obtain fresh `main` and real A8 live SHA, run only approved non-destructive exact-SHA QA via the paired A8 Local Agent, and separately guarded-deploy/read back the new revision. Docs-only edits: Git commit only, no A8 build, test, service restart or deployment. Never use GitHub Actions, Codex or Work.

Current work: follow the living [sprint checklist](ROADMAP.md), now Sprint 2 (simplification and dead-code audit). Public exposure, Android reboot and off-device recovery remain separately scoped.

## Owner's next visit

Do not act on the old night-sprint backlog. Resume from fresh main and the first unfinished item in [ROADMAP.md](ROADMAP.md). Update checklist evidence after each step. Preserve all existing Git history and immutable A8 receipts.
