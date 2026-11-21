---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current `main` source addition `b062c35eb081e378155e087e44282da3b91dc8a3`: read-only, owner-gated runtime preflight now separates missing data, unknown/not-provisioned, running and stopped. The helper always reports `snapshotEnabled:false`; stopped still requires separate offline-consistency review. **SOURCE ONLY — not yet deployed or QA-tested.** Last verified running A8 remains `2fffd41`.
- **Last attested A8 DEV code:** `2fffd41e9e1681d154a921465040d0c0a007ab1e`, guarded deployment `pockethost-a8-node-data-visibility-2fffd41-deploy-20261122-v1` **DEPLOY PASS**, PID **15121**, start ticks **71697467**, loopback HTTP **200**, protected services unchanged; tests **not run**. No data snapshot/restore, app-data provisioning or database operation was executed.
- **Latest scoped A8 QA:** `73b2da81144b207d0437e6ee56e209913eee6d99`, `pockethost-a8-node-backup-qa-73b2da8-20261121-v2`: `format,structure,boundaries,root-lint,root-types,node,syntax` PASS. Earlier broad changed-scope QA PASS at `6585afe`, 65/65 UI. Neither is full G2/admin build or physical G3.
- **Static ZIP:** export → isolated reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Node source Restic:** earlier scoped PASS. **Mutable data:** read-only owner-gated scope inventory is wired to Projects (source deployed, browser/API QA OPEN). Offline snapshot/checksum/staging classes remain **non-exposed, untested**. No actual app data root or snapshot created; no off-device backup.

## Current next work

1. **Resume gate:** connector task-publication returned an ambiguous error for the `b062c35eb081e378155e087e44282da3b91dc8a3` deployment. No corresponding task/result existed in `local-agent:agent-control` after checking, so **HOLD**; do not automatically replay. After explicit reconciliation, deploy exactly this source if still latest, then run only separately authorized exact-SHA QA. Existing live app data must remain untouched.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
