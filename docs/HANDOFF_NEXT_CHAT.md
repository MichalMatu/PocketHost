---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current code `170aed953b7eb89a9b90330fdff106c8cbc52e6f`: owner-only, read-only Node recovery checklist displaying storage ownership, observed stopped runtime, database consistency and separate snapshot approval; consistency and approval remain permanently unverified in this read-only API response. Per-category file/byte/folder inventory retained. The `76696ec` source was corrected by `170aed953b7eb89a9b90330fdff106c8cbc52e6f` for the absent-data/stopped-runtime boundary. No backup or restore route enabled.
- **Last attested A8 DEV code:** `170aed953b7eb89a9b90330fdff106c8cbc52e6f`, receipt `pockethost-a8-readonly-recovery-checklist-170aed9-deploy-20261122-v1`, **DEPLOY PASS**, PID **11439**, start ticks **71958880**, HTTP **200**, protected services unchanged. No new QA, app-data backup/restore, provisioning, live database mutation or off-device transfer.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`, seven checks `format,structure,boundaries,root-lint,root-types,node,syntax` (including fixture Node snapshot tests). No QA on the new `3cc6297efbac7ceba7f9d34facffcd00459b57ff` category inventory or browser UI; full G2/G3 remain OPEN.
- **Static ZIP:** isolated ZIP reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Source Restic:** older scoped PASS. **Mutable Node data:** read-only inventory with uploads/db/state breakdown deployed (QA pending); snapshot/staging fixture QA PASS at older `9b910d8dc353c512333b290a6749c60ad3df530f`. No write API, live database consistency proof, backup/restore or off-device recovery.

## Current next work

1. **Next:** the `170aed953b7eb89a9b90330fdff106c8cbc52e6f` checklist and category inventory need a fresh exact-SHA, category-scoped A8 QA approval (test categories normally `format,structure,boundaries,root-lint,root-types,node,syntax`). After that, a separately approved disposable project-only offline snapshot→staging exercise may qualify recovery mechanics. Real database consistency and explicit one-shot snapshot approval remain required before product actions are enabled.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
