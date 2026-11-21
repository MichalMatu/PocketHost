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

Latest guarded A8 DEV source `009ee552b87e1f14d9178781c7250582fcc755b4` is **DEPLOY PASS** (PID 1216, start ticks 71571850, HTTP 200, protected services unchanged), receipt `pockethost-a8-node-mutable-data-scope-009ee55-deploy-20261122-v1`. **Tests were not run** in that deployment. The last separately verified Node scope `73b2da8` passed format, structure, boundaries, root lint/TypeScript, Node and syntax (`pockethost-a8-node-backup-qa-73b2da8-20261121-v2`); earlier changed-scope 65/65 UI PASS at `6585afe`. New `NodeProjectDataScope` source/fixtures have **no QA PASS**. Static ZIP isolated reimport PASS; mutable application uploads/DB snapshot, full G2 coverage/admin build and physical G3 remain OPEN.

## Source-audit coverage limitation

The `check:boundaries` implementation statically examines imports under `src/`. The separate code-budget scan contains selected browser-import heuristics; neither walks the entire Vite/plugin/UI dependency graph or proves runtime ownership. A PASS is meaningful **within that gate's scope**, not proof of universal modularity or application-data recovery. The [22 November source checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md) records the inspected boundaries and outstanding extraction debt. No QA was run during that documentation-only review.
