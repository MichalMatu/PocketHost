---
status: active
owner: core
last_reviewed: 2026-11-19
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

Latest guarded A8 DEV source `9c3af55d591ea0805b8a90a70b4a7483e01379d9` is **DEPLOY PASS** (PID 21352, HTTP 200, protected services unchanged), receipt `pockethost-a8-qa-diagnostic-9c3af55-deploy-20261121-v1`. Separately `format,root-lint,node,syntax` **QA PASS** at this exact SHA, receipt `pockethost-a8-qa-gates-9c3af55-20261121-v1`. The pending isolated UI task `pockethost-a8-qa-ui-9c3af55-300s-20261121-v1` had no terminal receipt at last inspection; no UI/G2 PASS may be inferred. Mac Test Lab read-only visual/GET observations remain separate from A8 project QA and do not permit API mutations, reboot or public deployment.
