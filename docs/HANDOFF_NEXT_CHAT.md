---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Source change: `009ee552b87e1f14d9178781c7250582fcc755b4` introduced the **read-only**, strictly owned Node mutable-data scope, fixture tests and module documentation. Follow-up documentation commits are **not** deployed runtime.
- **Last attested A8 DEV code:** `009ee552b87e1f14d9178781c7250582fcc755b4`, guarded deployment `pockethost-a8-node-mutable-data-scope-009ee55-deploy-20261122-v1`: **PASS**, owned PID **1216**, start ticks **71571850**, loopback HTTP **200**, protected services unchanged; tests **not run**. Preceding A8 read-only inventory `pockethost-a8-node-mutable-data-readonly-inventory-20261122-v2`: one owned Node project, project data and snapshots roots **absent**.
- **Latest scoped A8 QA:** `73b2da81144b207d0437e6ee56e209913eee6d99`, `pockethost-a8-node-backup-qa-73b2da8-20261121-v2`: `format,structure,boundaries,root-lint,root-types,node,syntax` PASS. Earlier broad changed-scope QA PASS at `6585afe`, 65/65 UI. Neither is full G2/admin build or physical G3.
- **Static ZIP** active export -> independent temporary reimport/HTTP byte equality PASS; browser ZIP upload still OPEN. **Node Restic** attested source and nested assets QA PASS. The new `NodeProjectDataScope` separately inspects a private `uploads/db/state` namespace, rejecting links, foreign entries and over-budget files. It **does not create directories, back up mutable files, guarantee DB consistency or perform restore**, and it has not received scoped QA. Older device evidence: [21 November checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md).

## Current next work

1. **Mutable-data next stage:** exact-SHA QA of the new read-only inspector, then fixture-only provisioning and offline-consistent backup -> isolated staging restore. No live user data, no background backup; existing Node source Restic must remain independent.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
