---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `fd62f17263a5000e65958e5e3112109d9efa471a`: optional first ZIP receives browser-side structural preflight before site creation (central-directory envelope and local file header). Obvious renamed plain-text ZIPs cannot create empty owned sites. The server remains authoritative for individual assets, CRC and root index.html; existing-site ZIP uploads are unchanged. A valid stored ZIP fixture replaces previous placeholder text, plus one malformed ZIP regression. New QA not run.
- **Last attested A8 DEV code:** `fd62f17263a5000e65958e5e3112109d9efa471a`, receipt `pockethost-a8-static-initial-zip-preflight-fd62f17-deploy-20261122-v1`, guarded **DEPLOY PASS** (PID **15463**, start ticks **72300929**, loopback HTTP **200**, protected services unchanged). Tests OFF; no actual site creation/import, Node data or foreign services touched.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1` (`format,structure,boundaries,root-lint,root-types,node,syntax`). Latest browser ZIP preflight/creation and Node snapshot features at `fd62f17263a5000e65958e5e3112109d9efa471a` are **not QA certified**. Live browser ZIP acceptance, full G2/G3 OPEN.
- **Static ZIP:** older API ZIP export → isolated import/HTTP bytes PASS. New initial-ZIP creation is guarded-deployed with pre-POST structural preflight and independent readbacks, but **browser acceptance remains OPEN** until separately approved QA and disposable-site upload. Source Restic previously scoped PASS; Node mutable-data restore and consistency remain OPEN.

## Current next work

1. **Next:** fresh exact-SHA `fd62f17263a5000e65958e5e3112109d9efa471a` and check-category-scoped A8 QA for Static browser ZIP validation/creation/readback and relevant format/type/node categories, then separately approved disposable site browser upload with served-byte equality and cleanup. Do not modify established sites, real Node databases or unrelated services.
2. Browser ZIP-upload acceptance remains OPEN: source implements optional first ZIP during site creation and direct ZIP on an existing site, but local agent deployed code without running functional QA or a browser upload.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
