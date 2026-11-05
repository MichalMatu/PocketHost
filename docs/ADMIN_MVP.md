---
status: in-progress
owner: ui
last_reviewed: 2026-11-05
purpose: Record the complete ShadcnStore admin template import and native start procedure
---

# Admin Shell MVP — Full Template Before PocketHost Integration

## Scope

The first UI candidate is the **complete 30+ screen** upstream ShadcnStore React/Vite app, preserving all routes, demo data, charts, tables, forms, auth/error/settings pages, styles and assets. This is deliberate: no unused-screen cleanup or UI redesign in the first pass. Pin [upstream source](https://github.com/shadcnstore/shadcn-dashboard-landing-template) commit `866423741fa4b62d5e9427603cb2174aedf00f80`, retain the MIT notice, and import `vite-version/` into `apps/admin/`.

## Isolation and execution

Use **only the selected Termux phone's Local Agent host-command interface**, ordinary Git, Node/npm and an independent PocketHost checkout. No Agent project binding, Mac/sandbox compile, GitHub Actions, Codex, Work or automatic Termux app startup. Do not touch IleStoi.pl, Local Agent services or public ports.

Original pinned template branch: `feat/admin-shell-v1`. Current accepted P1.1 feature branch: `feat/host-health-v1`. For a fresh checkout, verify origin and current HEAD, then run the foundation gate on real Termux before installing or launching any app.

## First run (commands to dispatch through the authorized phone agent)

```sh
# Run from the verified, isolated PocketHost checkout.
npm run check:foundation
npm run admin:import
# For a *fresh* isolated full-template checkout only; never reimport into existing apps/admin.
cd apps/admin
npm ci --no-audit --no-fund
npm run build
npm run lint
# When 8787 is unoccupied, launch manually in foreground:
npm run dev -- --host 127.0.0.1 --port 8787 --strictPort
```

Do **not** assume these commands passed or the panel is running until actual Local Agent task results and HTTP check prove it. Pin package manager and lock after native preflight. If port 8787 is occupied, stop safely; do not select another port silently. If the Agent's bounded task runner cannot host persistent foreground processes, use a separate manually admitted, verified PocketHost-owned process method; never make an Agent service or boot hook launch the app.

## Quality and device acceptance

1. Every route and asset imported; no deleted demo pages.
2. On-device Node/npm/pnpm suitability checked, installed dependency lock valid, native build and lint pass.
3. `127.0.0.1:8787/dashboard` and several routes respond; no Vite binding to external interfaces.
4. Phone browser displays desktop-first sidebar/tables/charts, supports pinch zoom and panning; no disabled zoom viewport rule.
5. Running IleStoi.pl and Local Agent processes are not modified or restarted.
6. Record actual test commands, exit codes, source/import SHA and running process ownership in a checkpoint.

## Continued P1 host status route

`feat/host-overview-v1` adds a separate PocketHost **Host overview** entry to the existing template: live read-only Termux services and runtime memory data. The original 32 upstream route entries remain untouched; no demo view was deleted or repurposed. This is a **development-only**, loopback-only status middleware and must not be treated as production-ready authentication or service control.

## Commercial use and no upstream account

The imported full Vite version is the free [ShadcnStore dashboard template](https://github.com/shadcnstore/shadcn-dashboard-landing-template), pinned at `866423741fa4b62d5e9427603cb2174aedf00f80`. Its preserved `apps/admin/LICENSE.upstream.md` grants MIT rights, including commercial end products, redistribution and modification **provided copyright and license notices are retained**. This statement applies to the imported MIT source; do not infer permission to use separate premium ShadcnStore materials.

**PocketHost is self-hosted and requires no ShadcnStore account, subscription, token or license activation.** The provider's floating `Upgrade to Pro` button, sidebar advertisement, shop links and example customer profile are removed from the rendered app shell. Upstream auth/signup, billing, landing and pricing demo route source is retained for later reuse; demo screens are **not** connected to ShadcnStore identity, billing or authentication. Until PocketHost implements its own security controls, keep the development panel bound to loopback only and never expose it to the internet.

The existing responsive CSS and Android pinch zoom settings remain unchanged. The only `index.html` changes are local PocketHost metadata and removal of upstream social/marketing metadata.

## Current status

**Native demo and read-only host status are verified on physical Termux:** all 32 template screens retained, read-only `/host` added, P1.1 21/21 tests plus admin lint/build PASS and live GET/POST/Origin/Host checks PASS. The working local DEV preview remains `http://127.0.0.1:8787/host`. See [accepted P1 checkpoint](checkpoints/2026-11-05-host-overview-work-start.md) and [accepted P1.1 checkpoint](checkpoints/2026-11-05-host-health-work-start.md). **Full browser screenshot, pinch/zoom/a11y automation and root Gate 1 are still pending.**
