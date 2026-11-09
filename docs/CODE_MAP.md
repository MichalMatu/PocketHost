---
status: active
owner: core
last_reviewed: 2026-11-09
purpose: Small source entrypoint and impact map to avoid loading unrelated code
---

# PocketHost Code and Test Map

## First files to open

| Work                      | Source                                                                            | Focused checks                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| React routes / navigation | apps/admin/src/config/routes.tsx, navigation.ts                                   | tests/quality/admin-preservation.test.mjs                                                   |
| Termux UI / services      | apps/admin/src/app/termux/, apps/admin/src/app/host/                              | apps/admin/tests/termux-center.interaction.test.tsx, termux-admin.interaction.test.tsx      |
| Android & Shizuku UI      | apps/admin/src/app/shizuku/, apps/admin/src/lib/                                  | apps/admin/tests/shizuku-page.interaction.test.tsx, remote-shell-panel.interaction.test.tsx |
| H2 owned sites            | src/modules/host/site-fleet-host.ts, src/modules/sites/                           | tests/quality/site-fleet-host.test.mjs, site-bundle.test.mjs                                |
| Registry / ownership      | src/shared/hosting-registry.ts, src/modules/host/hosting-registry-store.ts        | tests/quality/hosting-registry*.test.mjs, hosting-service-ownership.test.mjs                |
| Termux host operations    | src/modules/host/termux-admin.ts, termux-service-admin.ts, termux-restic-admin.ts | tests/quality/h3-*.test.mjs, h34-*.test.mjs                                                 |
| Observability             | src/modules/host/observability-probes.ts, src/modules/observability/              | tests/quality/observability.test.mjs, host-snapshot.test.mjs                                |
| DEV flow                  | scripts/dev/, scripts/quality/                                                    | tests/quality/dev-*.test.mjs and applicable structure/docs checks                           |
| Android native Companion  | native/pockethost-companion/                                                      | native-focused Samsung tests only, do not claim from UI tests                               |

Test names above are **entrypoints, not a complete dependency graph**.
Use the change-aware dependency scanner first, then explicitly add
missing negative tests for runtime or indirect wiring. All actual
PocketHost commands run on Samsung Termux Local Agent.

## Boundaries

- **apps/admin:** React routes/components; Vite DEV middleware
  adapter lives in apps/admin/vite.config.ts.
- **src/modules/host:** Termux filesystem/process/runit/bridge
  operations behind narrow typed interfaces.
- **src/shared:** reusable pure contracts; no host side effects.
- **src/modules/sites, runtime, packages, config, observability:**
  domain validation/policies, not independent host shell calls.
- **native/pockethost-companion:** Android Shizuku Binder and
  loopback bridge; real OS permissions, not browser escalation.
- **scripts/dev:** isolated source sync and selective QA planner;
  never becomes a process supervisor.
- **tests/quality and apps/admin/tests:** Node negative contracts
  and Vitest UI interactions, respectively.

## Large-file hotspots — avoid bulk reading

The current source has a few unusually large files:

- apps/admin/vite.config.ts — about 55 KB, multiple DEV API
  middleware implementations. For future decomposition, extract
  **one endpoint adapter at a time** with unchanged host/Origin,
  intent, ownership and error contracts; run targeted host tests.
- apps/admin/src/app/shizuku/page.tsx — about 48 KB, UI tabs and
  actions. Extract self-contained presentational panels only
  with focused interaction tests.
- src/modules/host/site-fleet-host.ts — about 26 KB; keep
  process/owner lifecycle tests intact before splitting.
- apps/admin/src/utils/tweakcn-theme-presets.ts — about
  109 KB of upstream theme presets. Treat pinned upstream UI
  as preserved vendor data, **not** code to load or reformat
  for every PocketHost feature.

These sizes identify **review targets, not authorization** to rewrite
risky runtime code during a documentation cleanup. Prefer
file-specific reads, narrow edits and shared contracts over
importing entire directories into Agent context.

## Documentation ownership

Start with [START_HERE](START_HERE.md), root AGENTS.md and one
nearest scoped AGENTS.md. For behavior read the relevant
[MODULES](MODULES.md), [ARCHITECTURE](ARCHITECTURE.md)
or [Shizuku module](modules/shizuku.md) section. Historical
receipts live in [checkpoint archive](checkpoints/README.md);
do not preload every release log or the full target design.
