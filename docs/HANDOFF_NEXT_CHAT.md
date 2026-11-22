---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: One current resume pointer; evidence and architecture inventory in the checkpoint
---

# PocketHost — current handoff

**Current checkpoint:** [22 November source/modules/documentation review](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory process:** [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Version and proof boundary

- Current source feature `6d38d32bd25d28b32aacbacd5250c1d7af07454a`: formatting-only normalization of `NodeProjectDataSnapshots` schema-v2 directory inventory and fixture tests; data-path functionality unchanged from `590c576`. Approved QA on `590c576` failed at `format`; the new SHA has **not** been tested. Owner-only read-only data scope and runtime prerequisite inspection remain available; app-data backup/restore remain non-exposed.
- **Last attested A8 DEV code:** `6d38d32bd25d28b32aacbacd5250c1d7af07454a`, guarded receipt `pockethost-a8-node-data-format-6d38d32-deploy-20261122-v1` **DEPLOY PASS**, PID **27910**, ticks **71821899**, HTTP **200**, protected services unchanged; no tests during deploy, no app-data backup/restore or DB changes.
- **Latest A8 QA attempt:** approved exact-SHA `590c5768310473143528b3cffa1b7814013ee490`, receipt `pockethost-a8-node-data-qa-590c576-approved-20261122-v1`, **QA_FAIL: changed-file format** in `node-project-data-snapshot.ts` and its fixture test. Syntax, structure, boundaries, root lint PASS; root types/Node tests SKIPPED after failure. Latest older independently passing QA remains `73b2da8` for `format,structure,boundaries,root-lint,root-types,node,syntax`, and UI 65/65 PASS at `6585afe` — neither certifies the new snapshots.
- **Static ZIP:** export → isolated reimport/HTTP bytes PASS; browser ZIP upload OPEN. **Node source Restic:** earlier scoped PASS. **Mutable data:** read-only owner-gated scope inventory is wired to Projects (source deployed, browser/API QA OPEN). Offline snapshot/checksum/staging classes remain **non-exposed, untested**. No actual app data root or snapshot created; no off-device backup.

## Current next work

1. **Next:** request fresh per-SHA approval for `6d38d32bd25d28b32aacbacd5250c1d7af07454a` with categories `format,structure,boundaries,root-lint,root-types,node,syntax`. Verify both corrected formatting and Node snapshot fixtures; QA is not automatically rerun on a new SHA. Only after QA PASS pursue isolated-fixture recovery, not the real project.
2. Browser ZIP-upload acceptance into a newly created disposable owned site, with verified cleanup. Existing live API ZIP isolated reimport is already PASS.
3. Generic independent project create/import -> deploy -> health/logs -> update/rollback -> retained data; no `photomap.pl` migration yet.
4. Later: shared Pi Zero Cloudflare **one named tunnel** for an explicitly safe app only, physical Termux:Boot reboot, S1–S4 acceptance and comprehensive G2/G3 as separately authorized.

**Module separation debt:** `host` dominates implementation; `vite.config.ts` and service coordinators remain oversized; some registered modules are placeholders. See [module inventory](MODULES.md) and [code map](CODE_MAP.md); static boundary gates are not complete runtime isolation.

## Guardrails

Only paired Samsung A8 official Termux Local Agent via `MichalMatu/local-agent:agent-control` handles device operations/builds/deploys/QA. Keep code on current `main`, use one guarded deploy/readback per code change, and require a **fresh explicit exact-40-hex-SHA + check-category authorization for each QA**. Docs-only edits: Git commit, **no test/build/restart**. No Codex, Work, Actions, scheduler, automatic retry, Pi DNS/tunnel changes, public admin exposure, unowned services, reboot, destructive restore or off-device transfer.
