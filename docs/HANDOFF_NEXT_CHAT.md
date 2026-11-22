---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `cfa96a3c2fc33d89ce6f260fa36abb6f8f0b647a`: Static site creation/optional first ZIP flow separates the form validation error state from unavailable owned-catalog state. A definite HTTP 400 site-name rejection keeps existing verified sites visible and permits corrected submit. Editing name/ZIP cannot erase an unverified catalog failure. Two new frontend interaction regressions committed; QA not run.
- **Last attested A8 DEV code:** `cfa96a3c2fc33d89ce6f260fa36abb6f8f0b647a`, receipt `pockethost-a8-static-create-input-cfa96a3-deploy-20261122-v1`, **DEPLOY PASS** (PID **11762**, start ticks **72265903**, HTTP **200**, protected services unchanged). No latest functional tests or actual site import, existing sites and Node app-data untouched.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1` (`format,structure,boundaries,root-lint,root-types,node,syntax`). Browser create+ZIP flow, form-error boundary regressions, and newer Node detached snapshot features at `cfa96a3c2fc33d89ce6f260fa36abb6f8f0b647a` remain QA OPEN. G2/G3 OPEN.
- **Static ZIP:** old API export/reimport exact HTTP byte comparison PASS; deployed UI supports optional initial ZIP for new stopped sites, with independent creation and release readbacks. Two new form-error regressions are unrun. Real browser ZIP upload to a disposable owned site and cleanup remain OPEN. **Source Restic:** older scoped PASS. **Mutable Node:** inspection and detached checksum only; DB recovery OPEN.

## Current next work

1. **Next:** exact-SHA `cfa96a3c2fc33d89ce6f260fa36abb6f8f0b647a` and category-scoped QA on A8 for Static creation/ZIP interactions (plus relevant format/type/node checks), then owner-scoped disposable-site browser ZIP upload with exact served-byte proof and cleanup. Never touch the established owned sites, live Node DBs or protected services without separate scope.
2. Browser ZIP-upload acceptance remains OPEN: source implements optional first ZIP during site creation and direct ZIP on an existing site, but local agent deployed code without running functional QA or a browser upload.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
