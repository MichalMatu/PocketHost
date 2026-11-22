---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `e4d6a09b2ae6ce7b6290a65df1940f3261d446bd`: /sites offers **Publish starter HTML on creation** when ZIP and folder are unselected. It creates and publishes the bundled `index.html` through the same one-POST server-validated folder import route, with independent owned-inventory and exact-site release readbacks and no automatic Start. ZIP and folder imports were added at `48c21cc`, mutually exclusive with starter HTML. Existing sites and other services unchanged. Two new browser interaction cases unrun.
- **Last attested A8 DEV code:** `e4d6a09b2ae6ce7b6290a65df1940f3261d446bd`, receipt `pockethost-a8-static-starter-html-e4d6a09-deploy-20261122-v1`, guarded **DEPLOY PASS** (owned PID **2485**, start ticks **72479158**, loopback HTTP **200**, protected services unchanged). No functional QA for latest SHA, actual static-site import or protected-service mutation.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1` (`format,structure,boundaries,root-lint,root-types,node,syntax`). The newer Static ZIP/folder/starter one-step creation, write-lock UI, and Node detached snapshot features at `e4d6a09b2ae6ce7b6290a65df1940f3261d446bd` are **not** independently QA certified. Browser signoff and full G2/G3 OPEN.
- **Static ZIP:** older API export/reimport with exact served-byte equality PASS; latest browser UI now creates stopped sites from ZIP, folder or sample HTML in one request, with independent readbacks. Real browser ZIP/folder/starter signoff on an isolated disposable site and cleanup remain OPEN. Node database consistency/recovery proof OPEN.

## Current next work

1. **Next:** fresh exact SHA `e4d6a09b2ae6ce7b6290a65df1940f3261d446bd` and scoped check categories for A8 Static ZIP/folder/starter UI interaction tests plus relevant `format,structure,boundaries,root-lint,root-types,node,syntax`; separately approved disposable-site browser create/import, HTTP served-byte proof and cleanup. Do not touch established sites, live Node databases or protected services.
2. Real browser ZIP/folder/starter acceptance remains OPEN: code is guarded-deployed but latest UI tests were not run and no live disposable-site upload performed.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
