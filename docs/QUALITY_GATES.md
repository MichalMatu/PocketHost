---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Separate guarded deployment from independently approved QA
---

# Quality and deployment evidence

A **deployment PASS** requires terminal A8 Local Agent receipt at exact SHA, verified owned panel, PID/start ticks, HTTP and unchanged protected services. A code commit or queued task is not a deploy.

A **QA PASS** requires a terminal A8 result with the executed exact 40-character SHA and selected categories. The owner's standing consent for necessary non-destructive QA applies to **all future PocketHost sprints until revoked**; no repeated approval request per check or SHA. A test committed to Git, source inspection or deployment safety PASS is **not** QA PASS.

- G0 — structure, docs, boundaries, code-budget gate, Node foundation.
- G1 — format, Markdown, lint and TypeScript.
- G2 — full Node/UI regression, coverage and admin build.
- G3 — separate real-device functionality, isolation, reboot and restore with explicit consent.

## Size and modularity budget

`npm run check:code-budgets`: **24 KiB / 700 lines** maximum for new production TS/TSX/MJS files; **32 KiB / 1200 lines** for test files. Pinned oversized legacy source cannot grow, only shrink or disappear. Browser UI `apps/admin/src` may not import Termux host/Node-only modules; server-only Vite API plugins live in `apps/admin/plugins`. Existing `check:boundaries` enforces shared/host/module isolation. The budget runs in `check:foundation` when chosen for a separate A8 QA task under standing consent, never from deployment.

Latest guarded A8 DEV `522ef0582c79b13d00163c4cb4e0978e481e2f01` **DEPLOY PASS**, receipt `pockethost-a8-version-panel-522ef05-deploy-20261122-v1` (owned PID 14990, ticks 72859520, loopback HTTP 200, protected services unchanged). Separate **SCOPED QA PASS** at the same exact SHA, receipt `pockethost-a8-version-panel-522ef05-qa-20261122-v1`: format, admin TypeScript and dependent UI tests all pass. The three previous Static Hosting UI failures (uncertain ZIP message, local oversized folder, restore/prune history) were closed. This is not full G2 or physical G3 certification. Real-browser ZIP/folder/HTML upload, served-byte equality, cleanup, Node database consistency and recovery remain OPEN. Exact-SHA/category execution pinning is required; standing owner consent applies to all future non-destructive QA until revoked.

## Source-audit coverage limitation

The `check:boundaries` implementation statically examines imports under `src/`. The separate code-budget scan contains selected browser-import heuristics; neither walks the entire Vite/plugin/UI dependency graph or proves runtime ownership. A PASS is meaningful **within that gate's scope**, not proof of universal modularity or application-data recovery. The [22 November source checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md) records the inspected boundaries and outstanding extraction debt. No QA was run during that documentation-only review.
