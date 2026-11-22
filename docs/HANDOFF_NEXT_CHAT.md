---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current feature source `d2d5564ecc363b3542b3cd398e7104cf3ccc8d9d`: Static /sites starter mode now exposes editable first `index.html` and Reset sample HTML. Nonempty UTF-8 content up to 32 KiB is sent once via the existing owned import endpoint, with independent inventory/exact-site confirmation and no auto-start. Existing ZIP/folder/empty creation and deployed sites unchanged. Three interaction regressions (custom payload, empty HTML, oversized UTF-8) committed but not run.
- **Last attested A8 DEV code:** `d2d5564ecc363b3542b3cd398e7104cf3ccc8d9d`, receipt `pockethost-a8-custom-initial-html-d2d5564-deploy-20261122-v1`, guarded **DEPLOY PASS** (owned PID **6977**, start ticks **72514111**, loopback HTTP **200**, protected services unchanged). No functional QA of current SHA or actual browser site creation; protected services unchanged.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f` (`format,structure,boundaries,root-lint,root-types,node,syntax`), receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`. Recent editable starter HTML, ZIP/folder first import, uncertain-write UI and Node snapshot features at `d2d5564ecc363b3542b3cd398e7104cf3ccc8d9d` remain QA OPEN. Browser signoff and full G2/G3 OPEN.
- **Static ZIP:** previous API-only export/reimport/served-byte equality PASS; browser one-step create from ZIP/folder or editable starter HTML is now guarded-deployed with independent readbacks. Real browser acceptance on an isolated disposable site, served bytes and verified cleanup remain OPEN. Node database consistency/restore proof OPEN.

## Current next work

1. **Next:** run scoped A8 QA for the current exact source SHA under standing owner consent (`format,admin-types,ui` as relevant, plus narrowly selected additional checks), then separately plan browser create/import on a disposable owned site with served-byte check and verified cleanup. Do not touch existing sites, real Node DBs or protected services without distinct operation scope.
2. Real browser HTML/ZIP/folder acceptance OPEN: operational A8 deployment passed, but the new interaction tests remain unrun and no live browser upload performed.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and apply **standing owner approval for necessary non-destructive QA in every future sprint**; select categories and pin the exact 40-character SHA in each one-shot A8 QA command without requesting new consent. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
