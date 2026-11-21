---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Source reviewed on `main`: `96e3a1226eed352c0ab3ed510610a66b2a34b8c7` before the **documentation-only checkpoint**. Verify fresh `main` for every next task. Docs commits are **not** deployed runtime.
- **Last attested** running A8 DEV code: `96c2879d20fcfcbb6c59832e4706775adfec7ff4`, guarded deployment `pockethost-a8-node-backup-source-96c2879-deploy-20261121-v1`: PASS, owned PID/start ticks, loopback HTTP 200, protected services unchanged. **No new live A8 probe was performed by the 22 November documentation audit.**
- **Latest scoped A8 QA:** `73b2da81144b207d0437e6ee56e209913eee6d99`, `pockethost-a8-node-backup-qa-73b2da8-20261121-v2`: `format,structure,boundaries,root-lint,root-types,node,syntax` PASS. Earlier broad changed-scope QA PASS at `6585afe`, 65/65 UI. Neither is full G2/admin build or physical G3.
- **Static ZIP** active export -> independent temporary reimport/HTTP byte equality PASS; browser ZIP upload still OPEN. **Node Restic** attested source and nested assets follow-up QA PASS; mutable application uploads/DBs are **not backed up**. Older detailed evidence: [21 November checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md).

## Current next work

1. Project-owned **mutable data** model and local backup -> isolated staging restore on an independent disposable fixture; not a new Restic source-only repetition. Never alter live projects.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
