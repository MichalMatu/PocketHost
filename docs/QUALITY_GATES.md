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

Latest guarded A8 DEV `d0468ab0e4e7b2830c998aab6f406b2f15ad5a0b` **DEPLOY PASS**, receipt `pockethost-a8-demo-removal-d0468ab-deploy-20261122-v1` (owned PID 12014, ticks 73133851, HTTP 200, protected services unchanged). Post-showcase deletion code QA at `8f68257` PASS: syntax, changed format, structure, lint, admin TypeScript and mapped Node. `d0468ab0e4e7b2830c998aab6f406b2f15ad5a0b` format + affected UI test **PASS**; narrower layout/navigation/appearance checks passed in an earlier `8f68257` focused run, with two platform fixture failures corrected by `d0468ab`. Previous 300-second broad UI test run did **not** certify G2. Browser upload, mutable-data recovery and physical G3 remain OPEN; preserve exact-SHA receipt boundaries. [Checkpoint](checkpoints/2026-11-22-demo-cleanup-overnight-handoff.md).

## Source-audit coverage limitation

The `check:boundaries` implementation statically examines imports under `src/`. The separate code-budget scan contains selected browser-import heuristics; neither walks the entire Vite/plugin/UI dependency graph or proves runtime ownership. A PASS is meaningful **within that gate's scope**, not proof of universal modularity or application-data recovery. The [22 November source checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md) records the inspected boundaries and outstanding extraction debt. No QA was run during that documentation-only review.
