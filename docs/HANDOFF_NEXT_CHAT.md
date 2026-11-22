---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `f4698a46e5efb780752d0d74d8f7c604ab3e5076`: explicit new data inspection invalidates prior in-flight scope/index and snapshot verification responses, even for the same project/owner session. Stale replies silently drop instead of overwriting new status. Two UI regressions for overlapping inspections and stale verification added. Read-only API and disabled backup/restore remain unchanged.
- **Last attested A8 DEV code:** `f4698a46e5efb780752d0d74d8f7c604ab3e5076`, receipt `pockethost-a8-stale-snapshot-inspect-f4698a4-deploy-20261122-v1`, **DEPLOY PASS** (owned PID **1062**, start ticks **72173166**, loopback HTTP **200**, protected services unchanged). QA not run; no app-data backup/restore, database changes, provisioning, reboot or off-device copy.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1` (`format,structure,boundaries,root-lint,root-types,node,syntax`). The newer Node snapshot index, checksum verification, source-loss UI and stale-response fix at `f4698a46e5efb780752d0d74d8f7c604ab3e5076` have **not been separately QA certified**. Browser sign-off, full G2/G3 remain OPEN.
- **Static ZIP:** isolated ZIP reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Source Restic:** older scoped PASS. **Mutable Node data:** read-only inventory/recovery checklist, detached snapshot index and SHA-256 verification deployed, now accessible after source data loss. No mutation endpoints or real live-data recovery proof; database consistency and off-device protection still OPEN.

## Current next work

1. **Next:** exact-SHA A8 QA for `f4698a46e5efb780752d0d74d8f7c604ab3e5076` in `format,structure,boundaries,root-lint,root-types,node,syntax` and separately authorized UI interaction checks (delayed scope/index and verification responses). Then approved disposable project-only offline snapshot → hash → staging proof; no real database operations without separate scoped consent and consistency evidence.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
