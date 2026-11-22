---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `0ddf9127ec90611da755d55ce6655e61cdd9bf37`: Static Hosting ZIP upload UX rejects obvious invalid selections before PUT, preserves ambiguous-result HOLD semantics for network failures, reports definite invalid-input HTTP 400 and confirms a new nonempty release from exact owned-site readback. Three UI regression fixtures cover successful ZIP transport/receipt, empty ZIP and definitive 400 rejection. Node detached snapshot/stale-response feature unchanged.
- **Last attested A8 DEV code:** `0ddf9127ec90611da755d55ce6655e61cdd9bf37`, receipt `pockethost-a8-static-zip-ux-0ddf912-deploy-20261122-v1`, **DEPLOY PASS** (owned PID **5699**, start ticks **72209359**, loopback HTTP **200**, protected services unchanged). No functional QA; no real static import or Node DB backup/restore, unrelated services unchanged.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f` for `format,structure,boundaries,root-lint,root-types,node,syntax` (receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`). Latest Static browser ZIP UI and the newer Node detached-snapshot work remain untested at `0ddf9127ec90611da755d55ce6655e61cdd9bf37`; browser acceptance, full G2/G3 OPEN.
- **Static ZIP:** old isolated API export/reimport served-byte equality PASS; new browser ZIP preflight/error/readback code guarded-deployed, but **live browser ZIP upload remains OPEN** without exact-SHA QA and disposable site import/readback. **Source Restic:** older scoped PASS. **Mutable Node:** inspection + snapshot checksum only; database consistency/restore OPEN.

## Current next work

1. **Next:** explicitly approved exact SHA `0ddf9127ec90611da755d55ce6655e61cdd9bf37` scoped A8 QA (`format,structure,boundaries,root-lint,root-types,node,syntax`, plus appropriate frontend interaction category), then a separate owner-scoped real browser ZIP import into a disposable newly created static site with independent byte/HTTP readback and cleanup. Keep real owned sites, Node databases and foreign services untouched.
2. Browser ZIP-upload acceptance remains OPEN: deployed picker/readback UX and three unrun interaction fixtures do not substitute for a real upload into an isolated disposable site. API-only ZIP reimport has already passed.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
