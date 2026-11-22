---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Exact A8 guarded DEV and QA receipts with next autonomous safe code slice
---

# PocketHost — current handoff

**Runbook:** [night sprint](NIGHT_AUTONOMOUS_SPRINT.md). **Required:** [AGENTS](../AGENTS.md), [Termux A8 transport](LOCAL_AGENT_TERMUX.md), [DEV iteration](DEV_ITERATION.md), [MVP status](MVP_EXECUTION_PLAN.md).

## Verified N1–N8 evidence

- Source `main` immediately before this docs-only commit: `309298674040ee59f648911602ac6364740d9ff1`. Always read fresh `main` before another code change.
- **Latest guarded Samsung A8 DEV PASS:** `309298674040ee59f648911602ac6364740d9ff1`, task `pockethost-a8-night-n8-3092986-deploy-20261122-v1`: owned PID `29629`, start ticks `73600929`, loopback HTTP `200`, guarded owner/live SHA and protected services unchanged. These are recorded terminal receipt values, not a current live poll.
- **N1** — `b161a5a`, fix `83063b7`: faster safe deleted-UI QA impact mapping. Scoped A8 syntax/format/Node plus applicable root checks PASS; guarded DEV PASS, superseded.
- **N2** — `1c114cf`: separated Static Hosting create/import readback verification, pending/duplicate-submit feedback and fixture. Scoped A8 format/admin-types/UI PASS; guarded DEV PASS, superseded.
- **N3** — `3d79d2c` / `2739e4c` / `803cf75`: Node Projects selection-scoped release/runtime reads and stale-result fixture. Scoped A8 format/admin-types/UI PASS; guarded DEV PASS, superseded.
- **N4** — `73c2827` / `3c99b1c` / `97fccbc`: Local Agent raw console preserves original lines after failed refresh and offers retry; router/fixture correction. Scoped A8 format/admin-types/UI PASS across relevant final commits; guarded DEV PASS, superseded.
- **N5** — `92e1756` / `7bd95db`: read-only Test Lab screenshots of page bottoms with local artifacts, document-height geometry and allowlisted names. Scoped A8 syntax/format/structure/lint/Node PASS. **No panel deploy** for Test Lab source-only changes; actual Mac browser screenshot acceptance remains **OPEN**. Never publish screenshots or LAN data externally without separate authorization.
- **N6** — `0bbf2a` / `f9074ef` / `6f0c438` / final `86bbbaa90fdceb5ddd606066dd550adebb53c9aa`: project-scoped Node raw log reader, stale async response guard and fixture. Early TypeScript syntax FAILs fixed; final A8 `format,admin-types,ui` PASS, task `pockethost-a8-night-n6-86bbbaa-qa-20261122-v1`; guarded DEV PASS, superseded.
- **N7** — `3b39fbd3ebe975e611d923fb4c7df240a355383e`: Node releases explicit not-checked/empty/error states and read-only Retry. A8 `format,admin-types,ui` PASS task `pockethost-a8-night-n7-3b39fbd-qa-20261122-v1`; guarded DEV PASS, superseded.
- **N8** — `309298674040ee59f648911602ac6364740d9ff1`: read-only Refresh releases independent of full catalog, GET-only fixture. A8 `format,admin-types,ui` PASS task `pockethost-a8-night-n8-3092986-qa-20261122-v1`; guarded DEV PASS above.
- At checkpoint, A8 transport task/result directories were paired, with **no pending task**. Do not assume continued idle without rechecking.

## Still OPEN

Real browser Static ZIP/folder/custom HTML import, served-byte comparison and cleanup; independently created Node project acceptance; mutable-data restore; comprehensive G2 qualification; physical G3 reboot; public cutover; actual Mac Test Lab browser capture. Targeted QA and HTTP readback do **not** prove these.

## Next sprint N9

From newly verified `main`, address **stale Node Projects read-only Health/Preview responses** in `apps/admin/src/app/projects/page.tsx` (around Check live readiness / Preview local response). Like N6 logs, a delayed response must not update the new project after switching the selected project. Add one bounded cancellation/generation guard and fixture-only UI regression. Preserve exact source lines, full owner-token API contract and all deploy approvals. Run scoped A8 `format,admin-types,ui` and guarded DEV only after exact-SHA QA PASS. If blocked, pick another independent source-only module, not a retry of an unknown task.

No new scheduler, GitHub Actions, Codex/Work, unrelated services, public DNS/tunnels, real data writes or device reboot. Mac may run only the previously scoped private read-only Test Lab with verified origin/SHA; no screenshot export. Docs-only checkpoint does not require tests or panel restart. Night continuation still requires external Chat Bridge invocation; this chat does not run in the background after it ends.
