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

Source branch: `feat/admin-shell-v1`. The first run must verify its exact origin and clean checkout and pass the dependency-free foundation quality gate on Termux.

## First run (commands to dispatch through the authorized phone agent)

```sh
# Run from the verified, isolated PocketHost checkout.
npm run check:foundation
npm run admin:import
# Upstream Vite app has pnpm-lock.yaml; prefer the pinned pnpm workflow if pnpm is present.
cd apps/admin
pnpm install --frozen-lockfile
pnpm run build
pnpm run lint
# Alternative only after explicit dependency/lock review: npm install && npm run build.
# Then start manually in foreground on a distinct loopback-only port:
pnpm run dev -- --host 127.0.0.1 --port 8787 --strictPort
```

Do **not** assume these commands passed or the panel is running until actual Local Agent task results and HTTP check prove it. Pin package manager and lock after native preflight. If port 8787 is occupied, stop safely; do not select another port silently. If the Agent's bounded task runner cannot host persistent foreground processes, use a separate manually admitted, verified PocketHost-owned process method; never make an Agent service or boot hook launch the app.

## Quality and device acceptance

1. Every route and asset imported; no deleted demo pages.
2. On-device Node/npm/pnpm suitability checked, installed dependency lock valid, native build and lint pass.
3. `127.0.0.1:8787/dashboard` and several routes respond; no Vite binding to external interfaces.
4. Phone browser displays desktop-first sidebar/tables/charts, supports pinch zoom and panning; no disabled zoom viewport rule.
5. Running IleStoi.pl and Local Agent processes are not modified or restarted.
6. Record actual test commands, exit codes, source/import SHA and running process ownership in a checkpoint.

## Current status

Pinned importer and documentation are staged on the UI feature branch. **Native import, package installation, full compilation, browser screenshot and live server status are not yet verified** until returned by Local Agent.
