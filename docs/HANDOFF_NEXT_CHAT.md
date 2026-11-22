---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Current exact-SHA A8 DEV evidence and next independent coding task
---

# PocketHost — current handoff

**Execution queue:** [night sprint plan](NIGHT_AUTONOMOUS_SPRINT.md). **Previous checkpoint:** [post-demo cleanup](checkpoints/2026-11-22-demo-cleanup-overnight-handoff.md). **Acceptance:** [MVP tracker](MVP_EXECUTION_PLAN.md). **Required:** [root AGENTS](../AGENTS.md), [A8 transport](LOCAL_AGENT_TERMUX.md), [FAST FLOW](DEV_ITERATION.md).

## Verified code, QA and DEV

- Last product-code `main` snapshot before this documentation-only handoff: `1c114cfe4047ab386dcdcf63b50800ae1530d05f`. Re-read fresh `main` on every externally invoked turn.
- **Latest guarded A8 DEV PASS:** `1c114cfe4047ab386dcdcf63b50800ae1530d05f`, task `pockethost-a8-night-n2-1c114cf-deploy-20261122-v1`; owned PID `25554`, start ticks `73265102`, loopback HTTP `200`, protected services unchanged. This is terminal receipt evidence, not a continuously observed device probe.
- **N1 — scoped deleted-UI QA mapping:** `b161a5a961627441de19611adacfba72cc00f80e`, then format fix `83063b751325c60367d7022a4aa6d6a0fea11f5c`. Targeted A8 syntax, structure, root lint, format and dependency-mapped Node checks PASS over the two exact-source receipts; final `83063b7` syntax/format/Node task `pockethost-a8-night-n1-83063b7-qa-20261122-v1` PASS. Guarded DEV `83063b7` PASS, subsequently superseded by N2.
- **N2 — Static create/import readback extraction:** `1c114cfe4047ab386dcdcf63b50800ae1530d05f`. Extracted verification into `apps/admin/src/app/sites/verify-created-site.ts`, shortened legacy page, added in-progress feedback and a duplicate-submit fixture. Separate A8 `format,admin-types,ui` task `pockethost-a8-night-n2-1c114cf-qa-20261122-v1` **PASS**, then guarded DEV PASS above.
- These checks are scoped. Real browser ZIP/folder/custom HTML upload, served-byte equality and cleanup; independently created Node project browser acceptance; mutable-data restore; comprehensive G2 build/coverage; physical reboot G3; and public cutover remain **OPEN**. No owner acceptance or full-suite PASS inferred.

## Next code

**Start N3** from [night queue](NIGHT_AUTONOMOUS_SPRINT.md) on freshly verified `main`: extract one bounded Node Projects read-only selection, release-status or log-feedback controller from `apps/admin/src/app/projects/page.tsx`; preserve ownership-token flow, safe errors and existing API. Add narrow UI regression for stale async response and release selection. Use fixture-only QA and one exact-SHA guarded A8 DEV deployment after scope-limited QA PASS. If N3 is blocked, continue an independent N4 Local Agent console source slice without retrying an unknown task. Do not run generic Node rollout or mutable user-data tests.

Only paired Samsung A8 via `MichalMatu/local-agent:agent-control` performs builds, source/UI QA and guarded DEV deployment. No schedulers, Actions, Codex/Work, public/cloud routing, protected-service changes or real hosted-data writes. Docs-only handoff updates need no QA, build or restart. An external Chat Bridge invocation must initiate the next turn; this chat cannot itself keep running overnight.
