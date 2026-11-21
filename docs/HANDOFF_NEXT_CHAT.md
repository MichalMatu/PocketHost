---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature commit `2fffd41e9e1681d154a921465040d0c0a007ab1e`: `/projects` now includes an owner-authenticated, **read-only** application data inventory (storage state, count, bytes), backed by `GET /api/v1/node-projects/:id/data-scope`. Earlier `f9e52c8` offline-only local snapshots and staging code remain **not connected** to runtime operations. Docs-only commits are not deployed runtime.
- **Last attested A8 DEV code:** `2fffd41e9e1681d154a921465040d0c0a007ab1e`, guarded deployment `pockethost-a8-node-data-visibility-2fffd41-deploy-20261122-v1` **DEPLOY PASS**, PID **15121**, start ticks **71697467**, loopback HTTP **200**, protected services unchanged; tests **not run**. No data snapshot/restore, app-data provisioning or database operation was executed.
- **Latest scoped A8 QA:** `73b2da81144b207d0437e6ee56e209913eee6d99`, `pockethost-a8-node-backup-qa-73b2da8-20261121-v2`: `format,structure,boundaries,root-lint,root-types,node,syntax` PASS. Earlier broad changed-scope QA PASS at `6585afe`, 65/65 UI. Neither is full G2/admin build or physical G3.
- **Static ZIP:** export → isolated reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Node source Restic:** earlier scoped PASS. **Mutable data:** read-only owner-gated scope inventory is wired to Projects (source deployed, browser/API QA OPEN). Offline snapshot/checksum/staging classes remain **non-exposed, untested**. No actual app data root or snapshot created; no off-device backup.

## Current next work

1. **Mutable-data next stage:** separately approved exact-SHA QA of `2fffd41e9e1681d154a921465040d0c0a007ab1e` including Node/API/UI data-inventory and snapshot fixture behavior. Only after PASS safely connect authoritative offline runtime state and prove backup → staged restore on a **disposable fixture**; never operate on the existing live project.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
