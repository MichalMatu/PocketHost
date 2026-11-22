---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `3cc6297efbac7ceba7f9d34facffcd00459b57ff`: owner-only read-only per-category Node data inventory in Projects, with counts for files, bytes and directories, and strict aggregate checks. Existing offline runtime review stays advisory and snapshot/staging operations remain not exposed to API/UI. **No new feature QA yet.**
- **Last attested A8 DEV code:** `3cc6297efbac7ceba7f9d34facffcd00459b57ff`, receipt `pockethost-a8-data-categories-3cc6297-deploy-20261122-v1`, **DEPLOY PASS**, PID **5401**, start ticks **71900534**, loopback HTTP **200**, protected services unchanged; **tests not run**. No app-data provisioning, backup, restore, database operation or off-device transfer.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`, seven checks `format,structure,boundaries,root-lint,root-types,node,syntax` (including fixture Node snapshot tests). No QA on the new `3cc6297efbac7ceba7f9d34facffcd00459b57ff` category inventory or browser UI; full G2/G3 remain OPEN.
- **Static ZIP:** isolated ZIP reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Source Restic:** older scoped PASS. **Mutable Node data:** read-only inventory with uploads/db/state breakdown deployed (QA pending); snapshot/staging fixture QA PASS at older `9b910d8dc353c512333b290a6749c60ad3df530f`. No write API, live database consistency proof, backup/restore or off-device recovery.

## Current next work

1. **Next:** separately approved exact-SHA `3cc6297efbac7ceba7f9d34facffcd00459b57ff` QA for category inventory, API and browser view; then disposable A8 offline fixture snapshot → staging restore and authoritative DB-consistency integration. Never use the existing live project for recovery exercises.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
