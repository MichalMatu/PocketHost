---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Separate guarded deployment from independently approved QA
---

# Quality and deployment evidence

A **deployment PASS** requires terminal A8 Local Agent receipt at exact SHA, verified owned panel, PID/start ticks, HTTP and unchanged protected services. A code commit or queued task is not a deploy.

A **QA PASS** requires fresh owner approval naming the exact 40-character SHA and check categories, plus a terminal A8 result. A test committed to Git, source inspection or deployment safety PASS is **not** QA PASS.

- G0 — structure, docs, boundaries, code-budget gate, Node foundation.
- G1 — format, Markdown, lint and TypeScript.
- G2 — full Node/UI regression, coverage and admin build.
- G3 — separate real-device functionality, isolation, reboot and restore with explicit consent.

## Size and modularity budget

`npm run check:code-budgets`: **24 KiB / 700 lines** maximum for new production TS/TSX/MJS files; **32 KiB / 1200 lines** for test files. Pinned oversized legacy source cannot grow, only shrink or disappear. Browser UI `apps/admin/src` may not import Termux host/Node-only modules; server-only Vite API plugins live in `apps/admin/plugins`. Existing `check:boundaries` enforces shared/host/module isolation. The budget runs in `check:foundation` after separate owner approval, never from deployment.

Latest guarded A8 DEV source `3cc6297efbac7ceba7f9d34facffcd00459b57ff` is **DEPLOY PASS**, receipt `pockethost-a8-data-categories-3cc6297-deploy-20261122-v1` (PID 5401, start ticks 71900534, HTTP 200, protected services unchanged). Per-category Node data inspection code and UI are **not QA certified**. Last approved scoped QA PASS at `9b910d8dc353c512333b290a6749c60ad3df530f` for `format,structure,boundaries,root-lint,root-types,node,syntax` with snapshot/staging fixtures. No live data backup/restore, browser acceptance, G2 or G3 is implied; each new QA must follow root AGENTS exact-SHA/category approval.

## Source-audit coverage limitation

The `check:boundaries` implementation statically examines imports under `src/`. The separate code-budget scan contains selected browser-import heuristics; neither walks the entire Vite/plugin/UI dependency graph or proves runtime ownership. A PASS is meaningful **within that gate's scope**, not proof of universal modularity or application-data recovery. The [22 November source checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md) records the inspected boundaries and outstanding extraction debt. No QA was run during that documentation-only review.
