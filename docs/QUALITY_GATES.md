---
status: accepted
owner: core
last_reviewed: 2026-11-23
purpose: G0–G2 closure and independently verified deployment boundary
---

# Quality gates

**G0–G2 qualified on A8 at source `d2bacd081ad0879d49a08e3c7fd97789185ad6e4` (23 November 2026).** This is a source QA result, not proof that the same SHA is deployed.

| Gate | Acceptance                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| G0   | Structure, documentation, boundaries, file budgets: PASS                                                                  |
| G1   | Prettier, Markdown, root/admin ESLint and TypeScript: PASS (two non-blocking admin warnings)                              |
| G2   | Node 469 PASS / 1 SKIP; 76.11% lines, 81.72% branches, 80.50% functions; Vite build PASS; UI 486/486 PASS across 77 files |
| G3   | Separate device reboot, broad restore and resilience work; **not** certified by G2                                        |

**Exact A8 terminal receipts:** `pockethost-a8-g2-final-core-d2bacd0-20261123-v1` and `pockethost-a8-g2-final-allui-d2bacd0-20261123-v1`, each outer `done`, exit 0, inner `QA_PASS`. One Node hardlink test skipped because Android disallowed hardlink creation. Earlier failing G2 attempts are preserved in [qualification history](checkpoints/2026-11-23-g2-full-qualification.md).

**Last device-attested DEV:** `349087d2981c7fc3d8b9feba12d8fc335956a08b`, guarded deploy and HTTP readback PASS. A source commit, queued agent task or successful automated tests cannot be substituted for a live deployment receipt.

## Engineering constraints

New production TS/TSX/MJS files: **24 KiB / 700 lines**; test files: **32 KiB / 1200 lines**. Older pinned oversized files must shrink, not grow. The browser UI must not import privileged Termux host modules. Root `check:boundaries` and code-budget rules are conservative static checks; they do not prove total import-graph isolation or sandboxing.

Only verified A8 Local Agent may run project QA/build/deploy. Targeted tests require a separate exact-SHA task, with standing consent for necessary non-destructive checks. `ops/termux/fast-flow.mjs` is a guarded **deploy/readback** step, never an implicit test runner. For docs-only changes, do not rebuild or restart the panel.
