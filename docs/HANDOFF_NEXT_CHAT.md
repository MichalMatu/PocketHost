---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `e1d3d976307dae7d3e859fc80ea1e9fa0439a2af`: /sites has an optional **Initial ZIP** on new-site creation. Before POST it validates filename/size; after independent owned-inventory readback of the new stopped project, it sends one ZIP PUT, then verifies exact-site and inventory readbacks of a nonempty immutable first release. Definite 400 leaves empty project visible; ambiguous upload/readback blocks further actions pending refresh. No auto-start/retry/delete; existing sites untouched. Three UI regression scenarios committed but not run.
- **Last attested A8 DEV code:** `e1d3d976307dae7d3e859fc80ea1e9fa0439a2af`, receipt `pockethost-a8-static-first-zip-e1d3d97-deploy-20261122-v1`, **DEPLOY PASS** (owned PID **8870**, ticks **72238944**, loopback HTTP **200**, protected services unchanged). Tests not run, no actual static or Node user-data operation, protected services unaffected.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1` (`format,structure,boundaries,root-lint,root-types,node,syntax`). New Static **Create and import ZIP** frontend/fixture and Node detached-snapshot developments at `e1d3d976307dae7d3e859fc80ea1e9fa0439a2af` are **not independently tested**. Real browser first-ZIP acceptance, full G2/G3 OPEN.
- **Static ZIP:** previous API export → isolated reimport → HTTP byte comparison PASS; browser first-ZIP creation/import workflow now guarded-deployed but has **no live browser signoff**. Three new unrun UI tests cover success/invalid ZIP before POST/definitive 400 after creation. **Source Restic:** earlier scoped PASS. **Mutable Node:** inspection and detached checksum only; database consistency/restore OPEN.

## Current next work

1. **Next:** fresh exact-SHA `e1d3d976307dae7d3e859fc80ea1e9fa0439a2af` and category-scoped A8 QA for the Static ZIP creation/import UI, relevant type/format/node checks, and newly added fixtures; separately qualified real browser import into a *disposable* owned site, independent served bytes/readback and verified cleanup. Do not alter established owned sites, live Node databases, foreign services or Cloudflare.
2. Browser ZIP-upload acceptance remains OPEN: source implements optional first ZIP during site creation and direct ZIP on an existing site, but local agent deployed code without running functional QA or a browser upload.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
