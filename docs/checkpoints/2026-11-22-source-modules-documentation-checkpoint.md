---
status: checkpoint
owner: core
last_reviewed: 2026-11-22
purpose: Source-level module separation, documentation currency and delivery checkpoint
---

# PocketHost — source, modules and documentation checkpoint (22 November 2026)

## Evidence and scope

- Source snapshot reviewed: `MichalMatu/PocketHost` `main` at `96e3a1226eed352c0ab3ed510610a66b2a34b8c7` **before this documentation-only commit**. Repository Git tree was complete (not truncated). This checkpoint does not claim a new device inspection, deployment, test run or browser acceptance.
- **Last recorded verified A8 DEV runtime:** `96c2879d20fcfcbb6c59832e4706775adfec7ff4`, guarded deployment receipt `pockethost-a8-node-backup-source-96c2879-deploy-20261121-v1`: PASS, owned PID/start ticks, private HTTP 200 and protected services unchanged. This is last **attested**, not a new live readback on 22 November.
- **Latest relevant source QA:** A8 scoped `format,structure,boundaries,root-lint,root-types,node,syntax` PASS at `73b2da81144b207d0437e6ee56e209913eee6d99` (`pockethost-a8-node-backup-qa-73b2da8-20261121-v2`). Earlier broad changed-scope QA PASS at `6585afee5a67ce2768be9577fd6a7c173b284668` included 65/65 UI assertions. Neither is full G2/build/coverage or G3 physical acceptance.
- **Static ZIP:** active owned site export -> strict decode -> temporary independent import -> HTTP byte equality PASS, original unchanged and fixture removed (`pockethost-a8-live-static-export-isolated-import-6585afe-20261121-v1`). Browser ZIP upload into a newly created persistent site remains unverified.
- **Node backup:** source/assets scope fix `96c2879` covers attested nested source and binary assets; local encrypted backup/isolated staging restore has earlier narrow evidence. Mutable `uploads`, databases and application state are **not** included. No off-device recovery proof.
- **Change type in this checkpoint:** documentation only. No automatic QA, device command, build, deployment, restart, migration, scheduler, Pi tunnel/DNS change or user-data operation.

## Module separation — source inventory

The registered module set in `project.structure.json` has **10** entries. Among `src/modules/*`, **71** source or declaration `*.ts/*.mjs/*.mts` files were present at the source snapshot; distribution is intentionally uneven:

| Module | Source/declaration files | Observed role / maturity |
| --- | ---: | --- |
| `host` | 63 | Termux OS/filesystem/process/runit adapters and hosting operations; largest implementation area |
| `runtime` | 3 | Pure registered/owned runtime state and port contracts |
| `sites` | 2 | Static ZIP/folder parsing and owned-demo specification |
| `config` | 1 | Portable registry facade |
| `observability` | 1 | Read-only projection |
| `packages` | 1 | Dependency planning facade |
| `ai`, `diagnostics`, `inventory`, `shizuku` | 0 each | Registered placeholders/agent contracts, **not implemented standalone module services** |

**Separation reviewed:** `src/shared` carries portable contracts; browser UI/API clients live in `apps/admin/src`; host-side request handling is in the Node/Vite server (`apps/admin/vite.config.ts` and `apps/admin/plugins/node-project-api.ts`); privileged effects stay in host adapters. Static ZIP parsing in `sites` and owned state machines in `runtime` are distinct from host effects. External runit observation does not confer service ownership.

**Limit of review:** inspected the Git tree, representative module imports and the source of `check-boundaries.mjs`, `check-code-budgets.mjs` and `check-structure.mjs`. No new dynamic import graph, runtime ownership probe or test gate was executed. Existing `check-boundaries` scans `src/` and uses a conservative import-pattern check; it **does not certify** all cross-layer paths in `apps/admin`, Vite API endpoints, dynamic imports or runtime behavior. The code-budget browser check is similarly regex-based. Historical exact-SHA QA PASS does not close those blind spots.

## Structural debt, ranked

1. **P1 — persistent data boundary:** Node release-source attestation and Restic source backup are not application mutable-state recovery. Before implementing backups, define an independent project-owned data root, explicit ownership/scope, migration compatibility and restore-to-staging semantics. Existing Node process ownership checks include release working-directory expectations: changing `cwd` without redesigning those checks is unsafe.
2. **P2 — server/API composition:** `apps/admin/vite.config.ts` is about **1,549 lines / 76 KB**, directly composing many host modules and handlers. `apps/admin/plugins/node-project-api.ts` is an existing useful extraction seam. Further feature-bounded plugins must preserve request contracts and guard ordering.
3. **P2 — host service coordinator:** `src/modules/host/termux-service-admin.ts` is about **2,681 lines / 106 KB**; `node-runit-host.ts` about 1,275 lines / 49 KB. Keep external service ownership and lifecycle invariants in the host; split only with tested, behavior-preserving interfaces.
4. **P3 — admin screens:** `apps/admin/src/app/projects/page.tsx` about 66 KB and `termux/runit-service-actions.tsx` about 58 KB. Prefer feature hooks/sections and shared typed UI clients, not direct imports of host effects.
5. **P3 — architecture gates:** static boundary rules should eventually cover both Node-side Vite plugins and browser-side imports with a resolvable dependency graph. Pinned legacy file-size exceptions are debt, not approval to enlarge them.

Do not reclassify placeholder modules as delivered features. Do not attempt a sweeping folder shuffle; preserve separate Static/Node project identities, releases and guarded runit lifecycle.

## Current delivery status and handoff

**Working within previous exact evidence:** A8 private-LAN DEV panel, trusted Static/Node Hosting lifecycle, dedicated SSH, MQTT loopback, basic health and autostart visibility, selected UI regressions, static ZIP isolated API round-trip and narrow Node Restic source restore. **Not accepted:** latest full-browser flow, browser ZIP upload, mutable state recovery, general independent-project end-to-end, full G2/admin build/coverage, Android reboot G3, public ingress/host auth and off-device recovery.

**Next bounded implementation order:** (1) isolated fixture and owned persistent data model; (2) disposable browser ZIP upload with safe cleanup; (3) independent project import/deploy/logs/health/update/rollback/retained-data acceptance; (4) separately approved actual A8 ownership/readback and targeted QA for any changed code. Pi Zero keeps the sole existing Cloudflare connector and original origin; no new public routing.

Current entrypoints: [handoff](../HANDOFF_NEXT_CHAT.md), [MVP acceptance](../MVP_EXECUTION_PLAN.md), [module map](../MODULES.md), [code map](../CODE_MAP.md), [quality scope](../QUALITY_GATES.md). The [21 November checkpoint](2026-11-21-pocket-host-mvp-handoff.md) remains immutable historical evidence, not the latest status.
