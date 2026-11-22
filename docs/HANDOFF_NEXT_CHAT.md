---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current source `b3f747eb003ab943c5f271c40f16dbdedba82eed`: Node Projects now uses independent settled results for live mutable data scope and detached snapshot metadata, preserving existing archives after data-scope error. It displays distinct failure notices; snapshot integrity verification stays separately available. Three new UI interaction test cases cover source failure, index failure, and project/owner change. No mutation API, database-consistency certification or live backup.
- **Last attested A8 DEV code:** `b3f747eb003ab943c5f271c40f16dbdedba82eed`, receipt `pockethost-a8-independent-snapshot-ui-b3f747e-deploy-20261122-v1`, **DEPLOY PASS** (owned PID **27118**, ticks **72110307**, HTTP **200**, protected services unchanged). QA not run, no live app-data copy/restore/provisioning, no off-device transfer.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f` (seven checks `format,structure,boundaries,root-lint,root-types,node,syntax`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`). The newer read-only category inventory, recovery checklist, snapshot index, checksum verification and source-failure UI `b3f747eb003ab943c5f271c40f16dbdedba82eed` are **not independent QA certified**. New interaction tests are not run; browser, full G2/G3 OPEN.
- **Static ZIP:** isolated ZIP reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Source Restic:** older scoped PASS. **Mutable Node data:** read-only inventory/recovery checklist, detached snapshot index and SHA-256 verification deployed, now accessible after source data loss. No mutation endpoints or real live-data recovery proof; database consistency and off-device protection still OPEN.

## Current next work

1. **Next:** fresh explicitly SHA-scoped A8 QA for `b3f747eb003ab943c5f271c40f16dbdedba82eed` including `format,structure,boundaries,root-lint,root-types,node,syntax` and a separately scoped UI interaction check if authorized. Then an independently approved disposable A8 offline project-only snapshot → hash verification → staging proof, retaining the requirement for real database consistency before any live recovery.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
