---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `b4b816df863c9b4a247cb4a21f6846a2bb27d0a1`: fixes false positive UI verification status when checksum response metadata differs from selected detached snapshot index (ID, files, bytes or directories), with disabled repeat-click while checking; four parameterized regression cases added. Detached snapshot index still survives errors in mutable data scope; no backup/restore endpoints or database consistency claims.
- **Last attested A8 DEV code:** `b4b816df863c9b4a247cb4a21f6846a2bb27d0a1`, receipt `pockethost-a8-snapshot-verify-metadata-b4b816d-deploy-20261122-v1`, **DEPLOY PASS** (owned PID **30290**, start ticks **72141187**, loopback HTTP **200**, protected services unchanged). QA tests not run; no app-data backup/restore, database changes, provisioning, reboot or off-device transfer.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1` (`format,structure,boundaries,root-lint,root-types,node,syntax`). The newer Node category inventory, read-only recovery checklist, detached snapshots/verification and source-error UI including `b4b816df863c9b4a247cb4a21f6846a2bb27d0a1` have **not had separate QA or browser signoff**. Full G2/G3 OPEN.
- **Static ZIP:** isolated ZIP reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Source Restic:** older scoped PASS. **Mutable Node data:** read-only inventory/recovery checklist, detached snapshot index and SHA-256 verification deployed, now accessible after source data loss. No mutation endpoints or real live-data recovery proof; database consistency and off-device protection still OPEN.

## Current next work

1. **Next:** explicitly approved exact-SHA `b4b816df863c9b4a247cb4a21f6846a2bb27d0a1` A8 QA: `format,structure,boundaries,root-lint,root-types,node,syntax`, plus separate UI interaction category to exercise mismatched verification receipts; then approved disposable project-only offline snapshot → checksum → staging restore. Do not operate on real app DB; database consistency still needs separate proof.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
