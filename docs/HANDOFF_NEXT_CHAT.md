---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `50bbfdd8dec78616def7f10c7d50a97de3dfe5fa`: /sites initial ZIP creation uses a **single POST** to `/api/v1/sites/import?name=<encoded>` rather than separate POST create and PUT deploy. The server validates ZIP bytes before site allocation, then creates and publishes within the existing serialized write path. The UI independently reads the owned inventory and exact site before showing successful publication. A definitive ZIP 400 creates no project; unexpected post-create failure may leave an inert site and requires manual refresh, never blind retry or deletion. Existing-site ZIP uploads and empty-site creation unchanged.
- **Last attested A8 DEV code:** `50bbfdd8dec78616def7f10c7d50a97de3dfe5fa`, receipt `pockethost-a8-static-single-import-50bbfdd-deploy-20261122-v1`, guarded **DEPLOY PASS** (owned PID **21774**, ticks **72361760**, loopback HTTP **200**, protected services unchanged). Tests OFF; no actual static ZIP upload, Node database action or protected-service mutation.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f` (`format,structure,boundaries,root-lint,root-types,node,syntax`), receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`. Newly deployed single-POST Static import, its UI fixtures, and recent Node snapshot work at `50bbfdd8dec78616def7f10c7d50a97de3dfe5fa` have **not** had separate functional QA. Browser sign-off and full G2/G3 OPEN.
- **Static ZIP:** earlier API active ZIP export → isolated reimport and served-byte comparison PASS. New single-request first-ZIP path validates before site creation and requires independent readbacks, **but real browser ZIP upload still OPEN** until separately authorized disposable-site exercise with exact HTTP bytes and cleanup. Source Restic earlier scoped PASS; Node mutable data consistency/restore OPEN.

## Current next work

1. **Next:** fresh explicit exact-SHA `50bbfdd8dec78616def7f10c7d50a97de3dfe5fa` and QA-category approval on A8 for Static create/import UI + API regression and relevant `format,structure,boundaries,root-lint,root-types,node,syntax` checks, followed by separately scoped browser upload on a disposable owned site with served-byte verification and confirmed cleanup. Do not alter established sites, real Node DBs or protected services.
2. Browser ZIP-upload acceptance remains OPEN: single-POST initial upload and existing-site PUT are deployed but have not been executed through a real browser or covered by current exact-SHA QA.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
