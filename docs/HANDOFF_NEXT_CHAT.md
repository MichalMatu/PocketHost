---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- **Current live PocketHost A8 DEV:** `bb27312e74beba55ff6c9bf84dbd0e9b16dabeae`, guarded **DEPLOY PASS** in task `pockethost-a8-html-editor-read-bb27312-deploy-20261122-v1`: PID **24123**, start ticks **72952098**, loopback HTTP **200**, protected services unchanged. Quick HTML editor state is now isolated; stale or failed asynchronous HTML responses cannot overwrite the source after an owned inventory refresh.
- **Current scoped A8 QA PASS:** same source `bb27312e74beba55ff6c9bf84dbd0e9b16dabeae`, task `pockethost-a8-html-editor-read-bb27312-qa-20261122-v1`: **format, admin TypeScript, dependent UI tests PASS**, including the new stale HTML response/error regressions (~191 s). Previous `522ef0582c79b13d00163c4cb4e0978e481e2f01` had its own independent deploy/QA PASS and closed the three earlier Static Hosting UI failures (uncertain ZIP import, oversized folder preflight, restore/prune version history).
- **Independent browser File API fixture QA:** `ff398d6b36132b6dacca8003786022df4810bfc0` `format,ui` **PASS**. Real browser ZIP/folder/HTML import and exact served-byte/cleanup acceptance are still **OPEN**. Previous isolated API-only ZIP export/reimport PASS does not replace browser signoff.

## Current next work

1. **Next:** accept real browser ZIP/folder/custom HTML create/import on an isolated disposable owned site with served-byte verification and verified cleanup, under distinct scoped browser/device consent. Do not touch existing sites, real Node DBs or protected services without distinct operation scope.
2. Real browser HTML/ZIP/folder acceptance OPEN: interaction QA is separate from the unperformed actual browser upload/served-byte validation.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and apply **standing owner approval for necessary non-destructive QA in every future sprint**; select categories and pin the exact 40-character SHA in each one-shot A8 QA command without requesting new consent. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
