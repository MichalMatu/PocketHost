---
status: accepted
owner: core
last_reviewed: 2026-11-25
purpose: G0–G2 closure and independently verified deployment boundary
---

# Quality gates

**G0–G2 qualified on A8 at source `d2bacd081ad0879d49a08e3c7fd97789185ad6e4` (23 November 2026).** This is a source QA result, not proof that the same SHA is deployed.

| Gate | Acceptance                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Structure, documentation, boundaries, file budgets: PASS                                                                               |
| G1   | Prettier, Markdown, root/admin ESLint and TypeScript: PASS (two non-blocking admin warnings)                                           |
| G2   | Node 469 PASS / 1 SKIP; 76.11% lines, 81.72% branches, 80.50% functions; Vite build PASS; UI 486/486 PASS under the former test filter |
| G3   | Separate device reboot, broad restore and resilience work; **not** certified by G2                                                     |

**Exact A8 terminal receipts:** `pockethost-a8-g2-final-core-d2bacd0-20261123-v1` and `pockethost-a8-g2-final-allui-d2bacd0-20261123-v1`, each outer `done`, exit 0, inner `QA_PASS`. One Node hardlink test skipped because Android disallowed hardlink creation. Earlier failing G2 attempts are preserved in [qualification history](checkpoints/2026-11-23-g2-full-qualification.md).

## Sprint 4 closure — layered QA

- `pockethost-a8-sprint4-e3-qa-c21b278-20261124-v1`: all eight planned checks, browser boundary and budgets PASS.
- `pockethost-a8-sprint4-f-core-c21b278-20261124-v1`: 503 Node PASS, 1 SKIP; coverage lines 75.12%, branches 80.74%, functions 78.79%; lint/types/build PASS; full Prettier failed on three Markdown files.
- `pockethost-a8-sprint4-f-allui-c21b278-20261124-v2`: 490 UI tests PASS across 76 discovered files, despite 78-file inventory. Two TSX files were excluded by the old Vitest configuration.
- `pockethost-a8-sprint4-f-missing-ui-f581d2c-20261125-v1`: 12 PASS, 1 FAIL; dashboard tooltip suite PASS; Node backup stale session defect found.
- `pockethost-a8-sprint4-f-backup-qa-08caecc-20261125-v1`: exact-SHA affected UI regression, admin types/lint, documentation, full Prettier, budgets and Vite build PASS. No fresh full-suite aggregate is claimed at the final SHA.
- `pockethost-a8-sprint4-f-deploy-08caecc-20261125-v1`: terminal PASS, live `08caecc44a5ef1333a791c94d5b437cb0da49c97`, HTTP 200, protected services unchanged, dependencies unchanged.

Sprint 4 scoped code and integration regression closed. New physical reboot, extended endurance, off-device restore and clean-device updater qualification were not performed. Historical scoped recovery evidence remains in the handoff. A source commit or successful tests cannot substitute for live deployment evidence.

## Engineering constraints

New production TS/TSX/MJS files: **24 KiB / 700 lines**; test files: **32 KiB / 1200 lines**. Older pinned oversized files must shrink, not grow. The browser UI must not import privileged Termux host modules. Root `check:boundaries` and code-budget rules are conservative static checks; they do not prove total import-graph isolation or sandboxing.

Only verified A8 Local Agent may run project QA/build/deploy. Targeted tests require a separate exact-SHA task, with standing consent for necessary non-destructive checks. `ops/termux/fast-flow.mjs` is a guarded **deploy/readback** step, never an implicit test runner. For docs-only changes, do not rebuild or restart the panel.
