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

## Sprint 5 closure — Traffic Analytics

- `pockethost-a8-sprint5-a-qa-668a5fc-20261125-v1` and `pockethost-a8-sprint5-b-qa-5726b80-20261125-v1`: history and collector scoped QA PASS (5/5 checks each, budgets PASS).
- `pockethost-a8-sprint5-c-qa-66b46ea-20261125-v1`: format, boundaries, structure, root/admin lint/types and Node integration PASS, budgets PASS; UI timed out at the 300-second gate, not a PASS for that run.
- `pockethost-a8-sprint5-c-ui-build-66b46ea-20261125-v1`: all 19 mapped UI files, 143/143 tests and build PASS in three bounded batches.
- `pockethost-a8-sprint5-retention-qa-b49b81a-20261125-v1`: final source `b49b81a70a15d44ebaf3ec3733f168ba1936edbb`, all 10 checks PASS, including real HTTP integration and capacity recovery after verified Static deletion; budgets and admin build PASS. UI unchanged since the 143-test receipt.
- Final isolated Android HTTP benchmark: two baseline and two instrumented samples of 300 completed requests each. Mean CPU overhead 178000 microseconds per 300 requests, RSS overhead 2584576 bytes, peak RSS overhead 1912 KiB; active snapshots 498–499 bytes, 4096 allocated bytes. Benchmark budgets PASS; not an endurance or fleet-wide load test.
- `pockethost-a8-sprint5-deploy-b49b81a-20261125-v1`: terminal PASS; target live SHA matches, panel HTTP 200, protected services and dependency installation unchanged.
- `pockethost-a8-sprint5-postflight-b49b81a-20261125-v1`: terminal read-only PASS, one existing Static and one Node project, 4/4 traffic API reads across both ranges; all returned missing snapshots, no mutations or forced application restarts. Live collection in existing projects is not yet observed; isolated HTTP collection is qualified.

- Final closeout: `pockethost-a8-sprint5-closeout-gate-95d015f-20261125-v1` passed structure, full/changed docs, boundaries, budgets and Markdown; formatting failed on one extra space. `pockethost-a8-sprint5-closeout-format-c064fb7-20261125-v1` passed all three documentation checks at `c064fb7` after that whitespace-only correction; prior foundation and runtime evidence verified, live SHA unchanged. Sprint 6 remains TODO for the next iteration. This final evidence entry is documentation-only; no rebuild or deployment.

No fresh whole-repository test aggregate, seven-day physical endurance, or browser visual acceptance is claimed. The earlier Host-header fixture error was corrected without changing the production boundary. See [architecture](ARCHITECTURE.md) for collection semantics and retention constraints.

## Engineering constraints

New production TS/TSX/MJS files: **24 KiB / 700 lines**; test files: **32 KiB / 1200 lines**. Older pinned oversized files must shrink, not grow. The browser UI must not import privileged Termux host modules. Root `check:boundaries` and code-budget rules are conservative static checks; they do not prove total import-graph isolation or sandboxing.

Only verified A8 Local Agent may run project QA/build/deploy. Targeted tests require a separate exact-SHA task, with standing consent for necessary non-destructive checks. `ops/termux/fast-flow.mjs` is a guarded **deploy/readback** step, never an implicit test runner. For docs-only changes, do not rebuild or restart the panel.
