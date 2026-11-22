---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current source `421c13f8844375c56b9a025531a1913882e52573`: read-only owner-gated `GET /api/v1/node-projects/:id/data-snapshots/:snapshot/verify` compares stored archive bytes and v2 directories with the manifest; Projects UI offers a per-snapshot on-demand Verify action. Snapshot index is still metadata-only until explicitly checked. No database consistency proof, restore authorization, storage write API or automatic backup.
- **Last attested A8 DEV code:** `421c13f8844375c56b9a025531a1913882e52573`, receipt `pockethost-a8-snapshot-verify-421c13f-deploy-20261122-v1` **DEPLOY PASS**, owned PID **21012**, ticks **72052877**, loopback HTTP 200, protected services unchanged. Tests OFF during deploy; no app-data backup/restore, database change, provisioning, reboot or off-device transfer.
- **Latest scoped A8 QA PASS:** older `9b910d8dc353c512333b290a6749c60ad3df530f` (`format,structure,boundaries,root-lint,root-types,node,syntax`, receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`). The newer category inventory, checklist, manifest index and on-demand verify endpoint/UI in `421c13f8844375c56b9a025531a1913882e52573` have **no independent QA or browser sign-off**. Full G2/G3 OPEN.
- **Static ZIP:** isolated ZIP reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Source Restic:** older scoped PASS. **Mutable Node data:** category inventory, recovery checklist, manifest list, and explicit read-only checksum verification deployed; no real snapshot verified during this deployment, no backup/restore mutation routes or off-device protection.

## Current next work

1. **Next:** separately approved exact-SHA scoped QA for `421c13f8844375c56b9a025531a1913882e52573` (`format,structure,boundaries,root-lint,root-types,node,syntax`) including snapshot corruption and project isolation cases; then disposable A8 offline fixture snapshot → verify → private staging proof. Database consistency requires separate authoritative evidence before live recovery can be enabled.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
