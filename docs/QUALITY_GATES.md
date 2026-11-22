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

Latest guarded A8 DEV code `6d38d32bd25d28b32aacbacd5250c1d7af07454a` is **DEPLOY PASS** (receipt `pockethost-a8-node-data-format-6d38d32-deploy-20261122-v1`, PID 27910, start ticks 71821899, HTTP 200, protected services unchanged). Approved QA on `590c576` returned **QA_FAIL at changed-file format** (receipt `pockethost-a8-node-data-qa-590c576-approved-20261122-v1`; snapshot TS and fixture test warned). Syntax, structure, boundaries and changed-file lint PASS; root types and Node fixtures SKIPPED. Formatting-only correction `6d38d32bd25d28b32aacbacd5250c1d7af07454a` was deployed with tests OFF and is **not QA certified**. A fresh owner authorization naming this exact SHA and categories is required before any new QA; no real backup/restore, G2 or G3 performed.

## Source-audit coverage limitation

The `check:boundaries` implementation statically examines imports under `src/`. The separate code-budget scan contains selected browser-import heuristics; neither walks the entire Vite/plugin/UI dependency graph or proves runtime ownership. A PASS is meaningful **within that gate's scope**, not proof of universal modularity or application-data recovery. The [22 November source checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md) records the inspected boundaries and outstanding extraction debt. No QA was run during that documentation-only review.
