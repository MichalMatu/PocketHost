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

Latest guarded A8 DEV source `6585afee5a67ce2768be9577fd6a7c173b284668` is **DEPLOY PASS** (PID 8299, start ticks 70992303, HTTP 200, protected services unchanged), receipt `pockethost-a8-autostart-refresh-6585afe-deploy-20261121-v1`. Exact-SHA changed-scope QA on the same runtime source **PASS** for format, structure, boundaries, docs, Markdown, root/admin lint, root/admin TypeScript, Node, UI and syntax (`pockethost-a8-qa-closure-6585afe-20261121-v1`). This is not full G2 coverage/admin-build/physical certification. Test-only follow-up `ed1337e9eab4f70f2d393f0339468756b85bf042` **PASS** for Node and syntax (`pockethost-a8-static-zip-reimport-node-qa-ed1337e-20261121-v1`); this commit was **not deployed** because it adds no runtime code. Live A8 ZIP export → temporary independent-site reimport with matching HTTP content **PASS** (`pockethost-a8-live-static-export-isolated-import-6585afe-20261121-v1`); original unchanged and fixture removed. Browser-import acceptance remains open. Mac Test Lab is separate from A8 QA and grants no API mutation or reboot scope.
