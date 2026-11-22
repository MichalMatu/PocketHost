---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `41aa94a34f884ca9b4ab2e92fcfce29783e15cc3`: browser preflight of optional initial Static ZIP now scans bounded classic central-directory entries and prevents creation when a nonempty `index.html` is absent; accepts an archive with one shared top-level folder containing `index.html`. Adds two corresponding UI regressions; changes no existing-site ZIP route. Backend remains authoritative for content/path/CRC. QA not run.
- **Last attested A8 DEV code:** `41aa94a34f884ca9b4ab2e92fcfce29783e15cc3`, receipt `pockethost-a8-static-initial-zip-index-41aa94a-deploy-20261122-v1`, **DEPLOY PASS** (owned PID **18262**, start ticks **72326729**, loopback HTTP **200**, protected services unchanged). No actual site import, Node database change or protected-service mutation.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f` (`format,structure,boundaries,root-lint,root-types,node,syntax`), receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`. New browser ZIP preflight/creation and detached Node snapshot features at `41aa94a34f884ca9b4ab2e92fcfce29783e15cc3` remain untested. Live browser Static ZIP acceptance and full G2/G3 OPEN.
- **Static ZIP:** older API export/reimport and served-byte equality PASS. Latest initial-ZIP UI validates the existence of a nonempty homepage before creating an owned site; a common parent folder is accepted. **Real browser ZIP upload still OPEN** until independently approved disposable site exercise, exact bytes, and cleanup. Source Restic older scoped PASS; mutable Node database consistency/restore OPEN.

## Current next work

1. **Next:** fresh exact-SHA `41aa94a34f884ca9b4ab2e92fcfce29783e15cc3` and check-category approval for A8 UI interaction QA (missing/wrapped index), relevant format/types/node checks, then separate approved browser upload on a disposable owned Static site with served-byte proof and verified cleanup. Do not modify pre-existing sites, real Node DBs or protected services.
2. Browser ZIP-upload acceptance remains OPEN: source implements optional first ZIP during site creation and direct ZIP on an existing site, but local agent deployed code without running functional QA or a browser upload.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
