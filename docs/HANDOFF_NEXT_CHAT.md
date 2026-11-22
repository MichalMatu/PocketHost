---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- **Current live PocketHost A8 DEV:** `522ef0582c79b13d00163c4cb4e0978e481e2f01`, guarded deploy **PASS** in task `pockethost-a8-version-panel-522ef05-deploy-20261122-v1`: PID **14990**, start ticks **72859520**, loopback HTTP **200**, protected services unchanged. Source includes async owned-inventory freshness, jsdom browser File fixture methods, local folder-size preflight, distinct uncertain ZIP import messaging and preserved version-management view.
- **Current scoped A8 QA PASS:** `522ef0582c79b13d00163c4cb4e0978e481e2f01`, task `pockethost-a8-version-panel-522ef05-qa-20261122-v1`, **format, admin TypeScript and dependent UI suites all PASS** (runner 0, ~199 s). This closes the three previously failing H2 interaction cases: unconfirmed initial ZIP message, oversized folder rejection, and restore → prune version panel. The previous SHA `4dcc0d0` failed 3/56 UI cases; do not confuse it with the current passing receipt.
- **Independent browser File API fixture QA:** `ff398d6b36132b6dacca8003786022df4810bfc0` `format,ui` **PASS**. Real browser ZIP/folder/HTML import and exact served-byte/cleanup acceptance are still **OPEN**. Previous isolated API-only ZIP export/reimport PASS does not replace browser signoff.

## Current next work

1. **Next:** accept real browser ZIP/folder/custom HTML create/import on an isolated disposable owned site with served-byte verification and verified cleanup, under distinct scoped browser/device consent. Do not touch existing sites, real Node DBs or protected services without distinct operation scope.
2. Real browser HTML/ZIP/folder acceptance OPEN: interaction QA is separate from the unperformed actual browser upload/served-byte validation.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and apply **standing owner approval for necessary non-destructive QA in every future sprint**; select categories and pin the exact 40-character SHA in each one-shot A8 QA command without requesting new consent. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
