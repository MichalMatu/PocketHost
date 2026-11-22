---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current code `9b910d8dc353c512333b290a6749c60ad3df530f`: A8-generated exact Prettier diff applied to the schema-v2 Node app-data directory-preserving snapshots and fixture tests; read-only app-data inventory remains in Projects, backup and staging operations remain **not exposed** to API/UI.
- **Last attested A8 DEV code:** `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-exact-prettier-9b910d8-deploy-20261122-v1`, **DEPLOY PASS**, owned PID **32279**, start ticks **71860645**, loopback HTTP 200, protected services unchanged. No real app data backup/restore, DB changes or off-device transfer.
- **Latest A8 QA:** exact `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`, **QA PASS** (all seven: `format,structure,boundaries,root-lint,root-types,node,syntax`, including Node fixture tests and root TypeScript). Earlier `590c576`/`6d38d32` format QA FAILs are historical and superseded by the final Prettier correction. Earlier 65/65 UI PASS at `6585afe` does not certify the newest UI or full G2.
- **Static ZIP:** real isolated ZIP reimport/HTTP bytes PASS, browser ZIP upload still OPEN. **Source Restic:** earlier scoped PASS. **Mutable Node data:** read-only inventory and advisory runtime review deployed, snapshot/staging fixture tests PASS at `9b910d8dc353c512333b290a6749c60ad3df530f`; still no API mutation integration, real database consistency proof, live data backup, external recovery media or off-device copy.

## Current next work

1. **Next:** isolate and validate a disposable A8 project offline snapshot → staged restore against known fixture bytes and empty directories, then design authoritative offline-state consistency integration before ever enabling live backup/restore. The new snapshot code is QA PASS only within its scoped automated tests; real project data stays untouched.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
