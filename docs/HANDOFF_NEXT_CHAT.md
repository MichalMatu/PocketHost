---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `2802c75d2b9497f572e5c78e7219ba15f5e8d9cb`: Static site card requires new owned inventory after ambiguous write, failed exact-site readback, or confirmed write with failed inventory refresh; prevents stale repeated writes. Local folder-too-large/failed file read are definite preflight errors and do not lock the site. Optional saved-version refresh failures have separate feedback. Initial site ZIP create/import remains single server-validated POST (from `50bbfdd`). Two newest UI regressions unrun.
- **Last attested A8 DEV code:** `2802c75d2b9497f572e5c78e7219ba15f5e8d9cb`, receipt `pockethost-a8-site-refresh-folder-2802c75-deploy-20261122-v1`, guarded **DEPLOY PASS** (owned PID **27878**, ticks **72419779**, HTTP **200**, protected services unchanged). No latest functional QA, actual browser import, Node database changes or protected-service mutation.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1` (`format,structure,boundaries,root-lint,root-types,node,syntax`). Recent Static single-POST first ZIP, per-site uncertain-write locks, local folder-error handling and Node detached snapshots at `2802c75d2b9497f572e5c78e7219ba15f5e8d9cb` remain QA OPEN. Browser sign-off and G2/G3 OPEN.
- **Static ZIP:** older API export/reimport served-byte equality PASS. Current first ZIP uses one POST with pre-create server validation, followed by independent readbacks; uncertain writes block retries until refresh and local folder preflight errors are correctly distinguished. Real browser ZIP upload to disposable site and cleanup remain OPEN. Node mutable-data recovery proof OPEN.

## Current next work

1. **Next:** fresh exact-SHA `2802c75d2b9497f572e5c78e7219ba15f5e8d9cb` and check-category-scoped A8 QA for Static one-POST ZIP import, write locks and local folder validation (plus relevant `format,structure,boundaries,root-lint,root-types,node,syntax`), followed by separately approved disposable-site browser import, served-byte check and cleanup. Never touch existing owned sites, live Node databases or protected services.
2. Browser ZIP-upload acceptance remains OPEN: single-POST initial upload and existing-site PUT are deployed but have not been executed through a real browser or covered by current exact-SHA QA.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
