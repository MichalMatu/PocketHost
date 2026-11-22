---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current source `bf2a1727e138764c7b923edca7722d77aa737a5b`: detached Node snapshot listing and SHA-256 verification validate project ownership via `NodeProjectHost.inspect` independently of mutable data storage. Missing/damaged live app data no longer blocks checking archived copies. Added fixture tests for missing live source and unknown catalog identity. Read-only recovery UI and owner checks remain; no new backup/restore endpoints or database-consistency claim.
- **Last attested A8 DEV code:** `bf2a1727e138764c7b923edca7722d77aa737a5b`, receipt `pockethost-a8-detached-data-loss-bf2a172-deploy-20261122-v1` **DEPLOY PASS**, PID **24188**, start ticks **72083465**, loopback HTTP **200**, protected services unchanged. Tests OFF during deploy; no real app-data backup/restore, database changes, provisioning, reboot or off-device copy.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f` (`format,structure,boundaries,root-lint,root-types,node,syntax`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`). The newer category inventory, recovery checklist, snapshot index, on-demand verification, and source-loss fix `bf2a1727e138764c7b923edca7722d77aa737a5b` are **not independently QA certified**. Browser sign-off, full G2/G3 OPEN.
- **Static ZIP:** isolated ZIP reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Source Restic:** older scoped PASS. **Mutable Node data:** read-only inventory/recovery checklist, detached snapshot index and SHA-256 verification deployed, now accessible after source data loss. No mutation endpoints or real live-data recovery proof; database consistency and off-device protection still OPEN.

## Current next work

1. **Next:** exact-SHA QA for `bf2a1727e138764c7b923edca7722d77aa737a5b` in `format,structure,boundaries,root-lint,root-types,node,syntax`, including source-loss fixture and catalog isolation; then disposable A8 offline fixture snapshot → verify → isolated staging proof, never a live database. Real app recovery still requires authoritative DB consistency and explicit scoped approval.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
