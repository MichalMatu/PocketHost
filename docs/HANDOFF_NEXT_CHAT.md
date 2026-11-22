---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Single current resume pointer with exact-SHA evidence and autonomous next tasks
---

# PocketHost — current handoff

**Current checkpoint:** [post-demo cleanup and overnight handoff](checkpoints/2026-11-22-demo-cleanup-overnight-handoff.md). **Next work:** [autonomous coding queue](NIGHT_AUTONOMOUS_SPRINT.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Mandatory:** [AGENTS](../AGENTS.md), [A8 transport](LOCAL_AGENT_TERMUX.md) and [FAST FLOW](DEV_ITERATION.md).

## Verified code, deployment and QA

- GitHub `main` at the checkpoint: `d0468ab0e4e7b2830c998aab6f406b2f15ad5a0b`. The upstream `Framework / CMS examples` group and sample routes/assets are gone: **158 removed tracked files, 6,083,773 blob bytes**, accounting not a measured production bundle saving. Real management routes and appearance settings retained. Read fresh `main` on each turn.
- Last verified A8 DEV `d0468ab0e4e7b2830c998aab6f406b2f15ad5a0b`: guarded **DEPLOY PASS** `pockethost-a8-demo-removal-d0468ab-deploy-20261122-v1`, PID `12014`, ticks `73133851`, HTTP `200`, protected services unchanged; not a fresh running-device probe beyond the task receipt.
- Core scope **QA PASS** at `8f682579ce2a9160be5a37fcc2d6490b826ef80d`: syntax, format, structure, root lint, admin TS and Node contract tests (`pockethost-a8-demo-removal-8f68257-core-qa-20261122-v1`). Later changes were UI-test fixes. Latest `d0468ab0e4e7b2830c998aab6f406b2f15ad5a0b` targeted **format + UI PASS**: `pockethost-a8-demo-removal-d0468ab-platform-qa-20261122-v1`. Other demo-related focused UI checks passed except two platform test-context fixtures later corrected. Do not claim broad G2/UI PASS or physical G3.
- Real browser ZIP/folder/custom HTML file upload + served-byte equality + cleanup remain **OPEN**. Also OPEN: generic independently created Node project browser end-to-end signoff, mutable-data restore, full G2 build/coverage, physical Termux:Boot reboot and public cutover.

## Next code

**Start N1** in [night plan](NIGHT_AUTONOMOUS_SPRINT.md): make dependent QA quick and deterministic after large demo removal, without weakening deployment guards; then N2 Static create/import UX, N3 Node Projects UI, N4 Local Agent log console, N5 read-only screenshot/geometry Test Lab. Deliver one focused source change per Bridge turn and continue on later turns. A timed-out or failing *noncritical broad* QA gate should not halt all unrelated coding; record failure, fix or park that feature, and move to a safe independent slice. **Do not deploy unverified/broken changes.**

Only paired Samsung A8 Termux Local Agent via `MichalMatu/local-agent:agent-control` performs build/QA/deploy; Mac exception is read-only Test Lab only. Owner has standing QA/guarded DEV consent; no repeated approval requests. No new scheduler, actions, Codex/Work, unsafe live-data/browser mutations, public tunnel changes, physical reboot or protected-service changes. Docs-only changes: commit, no device QA/build/restart. Each chat turn is finite; continuation requires another external Chat Bridge invocation.
