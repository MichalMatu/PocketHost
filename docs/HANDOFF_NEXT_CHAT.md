---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current source feature: `f9e52c83d7884d6db84e3946de9c4e017d930059` adds manually authorized **offline-only** local app-data snapshots, SHA-256 manifest verification and restore into new staging; handles multiple owned projects in a shared root. Documentation-only commits are not runtime.
- **Last attested A8 DEV code:** `f9e52c83d7884d6db84e3946de9c4e017d930059`, receipt `pockethost-a8-node-data-multisite-f9e52c8-deploy-20261122-v1` **DEPLOY PASS**, PID **9021**, start ticks **71636843**, loopback HTTP **200**, protected services unchanged. Deployment ran **no tests, no backup/restore and no project-data operations**. Previous code deploy `67168dc` also passed, superseded by the multi-project fix.
- **Latest scoped A8 QA:** `73b2da81144b207d0437e6ee56e209913eee6d99`, `pockethost-a8-node-backup-qa-73b2da8-20261121-v2`: `format,structure,boundaries,root-lint,root-types,node,syntax` PASS. Earlier broad changed-scope QA PASS at `6585afe`, 65/65 UI. Neither is full G2/admin build or physical G3.
- **Static ZIP:** export → isolated reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Node source Restic:** scoped PASS, separately. **Mutable app data:** `NodeProjectDataScope` + `NodeProjectDataSnapshots` code now deployed but **not active in API/UI, not QA certified**. Creates local unencrypted snapshots only after per-operation approval and verified-offline callback; checksum verification and staging-only restore are implemented, not physically proven. No data root or snapshots created by this work.

## Current next work

1. **Mutable-data next stage:** run separately approved exact-SHA `format,structure,boundaries,root-lint,root-types,node,syntax` QA at `f9e52c83d7884d6db84e3946de9c4e017d930059`; then safely connect offline-state verification and test a **disposable fixture only** for backup → staging restore. Do not run a backup of the existing project.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
