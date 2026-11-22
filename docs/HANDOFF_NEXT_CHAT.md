---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Exact A8 guarded DEV and QA receipts with next autonomous safe code slice
---

# PocketHost — current handoff

**Runbook:** [night sprint](NIGHT_AUTONOMOUS_SPRINT.md). **Required:** [AGENTS](../AGENTS.md), [Termux A8 transport](LOCAL_AGENT_TERMUX.md), [DEV iteration](DEV_ITERATION.md), [MVP status](MVP_EXECUTION_PLAN.md).

## 22 November continuation — capture failure reporting

- **Source-only Visual QA fix:** `8a35bebafec0ce83a8393be3d147ec2db98576ea` adds `scripts/test-lab/capture-warnings.mjs`, local gallery warnings for failed top/middle/bottom/Node create-panel snapshots, additive `captureSummary` counters in `report.json` and summary output, plus `tests/quality/test-lab-capture-warnings.test.mjs`. The previous `failures` count retains its original primary-capture meaning. No screenshot was captured or transmitted.
- **QA remains OPEN:** new tests are committed but have not run on A8. No builds, Mac Test Lab browser run or DEV deploy were executed. Source-only Test Lab tooling does **not** warrant a panel restart.
- **A8 queue rechecked:** `pockethost-a8-night-n12-dde5a04-qa-20261122-v1` remains present as an immutable task but has no terminal `task-results` file in `MichalMatu/local-agent:agent-control`. Do not duplicate it or queue overlapping A8 tasks. On a later externally triggered continuation, reconcile the exact terminal result and verify fresh live ownership before planning targeted current-`main` QA. Last confirmed A8 DEV PASS remains N11 `c4dedfd`.
- **Next after unblocking:** choose an exact fresh `main` SHA and minimal A8 categories for both pending Node UI and Test Lab changes, repair named failures, then guarded DEV only for qualified runtime changes. Test Lab-only changes do not need runtime deployment.

## Latest N12–N13 continuation (22 November 2026)

- Fresh source `main` before this docs-only commit: `7c3728f9a047cb2d750de1101038ec792a7e7f5a`. **DEV remains N11 `c4dedfd23b597a95a96f00379786fe36f6cf27e2` only**, as last attested by the terminal guarded deployment receipt. Do not treat this as a new live inspection.
- **N12 Node create flow**: `a3ba281aea304f15114a1aadd1e95d55eb2b3f73` implemented pending/confirmed/rejected/unknown POST feedback, catalog identity readback and no duplicate submission on lost acknowledgement. A8 task `pockethost-a8-night-n12-a3ba281-qa-20261122-v1` was **QA FAIL** due to TS18046 in `page.tsx`; format passed, UI skipped. Type fix `dde5a044b5ef7adefd95dc0fbe219d39021c0179`. A8 task `pockethost-a8-night-n12-dde5a04-qa-20261122-v1` **has no terminal result in the checked private transport**. Do not retry, replace, or infer PASS.
- **Independent source-only Visual QA slice** `4afcf1c66eb4904dd708b4ad985f944f30675a74`: bounded middle-viewport screenshot for very tall document pages; matching local gallery/preview filename allowlist and regression. No screenshot uploaded, no Mac capture run, no panel code deployment or QA claimed. **N12 fixture repair** `7c3728f9a047cb2d750de1101038ec792a7e7f5a` opens the collapsed create panel during the interaction test. This fixture fix is also **not QA-verified**.
- Source `main` has advanced beyond the immutable pending N12 task's pinned target `dde5a04`. That task explicitly checks fetched `main == target`, so if it executes later it can terminally **HOLD `remote-main-moved`**. Let it finish; do **not** edit or duplicate an unknown Agent task, and do not deploy N12 or newer code based on a historical receipt.
- **Next action:** first receive the terminal N12 task result, verify no other A8 conflicts and fresh live ownership. Only then select an exact current `main` SHA and the applicable targeted QA categories (admin UI/TypeScript, test-lab Node/syntax/format); fix any named failure before guarded DEV. The Test Lab tooling-only changes themselves do not justify a panel restart. Continue small *independent* source slices only while the A8 task remains unknown. No schedulers, real project creation, public tunnel, external data or protected-service operations.

## Latest Visual QA source-only work — continue from current main

- **Further read-only Visual QA:** `d29af2dbd50cd45233f88e73cb572deca73092f4` adds a strictly allowlisted `projects-*-create-panel.png` artifact and source-only interaction to expand/capture/restore the Node creation `<details>` at each viewport; no POST and no real project creation. `d387303f005686c510789638d7ae266ff3f60535` limits this screenshot to the selected browser viewport rather than unbounded element height. The artifact-name allowlist regression was expanded. **No A8 QA or live Mac capture has verified these yet.** `main` before this docs-only update was `d387303f005686c510789638d7ae266ff3f60535`.
- **A8 blocker persists:** immutable task `pockethost-a8-night-n12-dde5a04-qa-20261122-v1` lacks a terminal task-result on branch `agent-control`, while later unrelated host publications exist. Its frozen target `dde5a04` is behind `main`, so eventual preflight could return `remote-main-moved`. Do not requeue/modify this task while pending, overlap same checkout, call this QA PASS, or deploy unverified panel changes. After it resolves, run targeted QA on a fresh exact `main` and consider guarded DEV only after PASS and live guard readback.
- Latest source `main` before this documentation update: `92b2851cd7eed9a5e9f8102f089294b2ffb4ed07`.
- `a41a04fabc0cc5e16f32d2d76cb8320ab17de7a8`: exact numeric viewport scroll targets, top reset, verified actual middle/bottom scroll displacement before saving local PNGs; new `tests/quality/test-lab-scroll-capture.test.mjs`. **A8 QA not run**.
- `92b2851cd7eed9a5e9f8102f089294b2ffb4ed07`: extracted browser-evaluable `inspectPageGeometry`, bounded structural overflow samples (no user text/URLs/values), and new `tests/quality/test-lab-layout-geometry.test.mjs`. **A8 QA not run**.
- Latest queue read showed exactly one unmatched A8 task: `pockethost-a8-night-n12-dde5a04-qa-20261122-v1`; it is pinned to old main `dde5a04` and may fail with `remote-main-moved` when executed. Do not replay or overlap it. No additional A8 QA, guarded DEV, physical browser capture, screenshots transmission or panel restart occurred in this continuation. Last attested DEV remains N11 `c4dedfd`.
- On next externally triggered turn, obtain that task's terminal receipt first; then select the fresh exact source SHA for scoped A8 `format,admin-types,ui,node` or policy-recommended minimal check mapping, resolve failures, and only after PASS consider guarded DEV for panel code. Visual QA tooling-only changes do not require panel deployment. Do not create a new scheduler.

## Verified N1–N8 evidence

- Source `main` immediately before this docs-only commit: `c4dedfd23b597a95a96f00379786fe36f6cf27e2`. Always read fresh `main` before another code change.
- **Latest guarded Samsung A8 DEV PASS:** `c4dedfd23b597a95a96f00379786fe36f6cf27e2`, task `pockethost-a8-night-n11-c4dedfd-deploy-20261122-v1`: owned PID `13596`, start ticks `73746912`, loopback HTTP `200`, sourcePinned/liveSha agree and protected services verified unchanged. Deployment tests=`not-run`; separate A8 QA receipt below. These are terminal receipt values, not continuously observed live state.
- **N1** — `b161a5a`, fix `83063b7`: faster safe deleted-UI QA impact mapping. Scoped A8 syntax/format/Node plus applicable root checks PASS; guarded DEV PASS, superseded.
- **N2** — `1c114cf`: separated Static Hosting create/import readback verification, pending/duplicate-submit feedback and fixture. Scoped A8 format/admin-types/UI PASS; guarded DEV PASS, superseded.
- **N3** — `3d79d2c` / `2739e4c` / `803cf75`: Node Projects selection-scoped release/runtime reads and stale-result fixture. Scoped A8 format/admin-types/UI PASS; guarded DEV PASS, superseded.
- **N4** — `73c2827` / `3c99b1c` / `97fccbc`: Local Agent raw console preserves original lines after failed refresh and offers retry; router/fixture correction. Scoped A8 format/admin-types/UI PASS across relevant final commits; guarded DEV PASS, superseded.
- **N5** — `92e1756` / `7bd95db`: read-only Test Lab screenshots of page bottoms with local artifacts, document-height geometry and allowlisted names. Scoped A8 syntax/format/structure/lint/Node PASS. **No panel deploy** for Test Lab source-only changes; actual Mac browser screenshot acceptance remains **OPEN**. Never publish screenshots or LAN data externally without separate authorization.
- **N6** — `0bbf2a` / `f9074ef` / `6f0c438` / final `86bbbaa90fdceb5ddd606066dd550adebb53c9aa`: project-scoped Node raw log reader, stale async response guard and fixture. Early TypeScript syntax FAILs fixed; final A8 `format,admin-types,ui` PASS, task `pockethost-a8-night-n6-86bbbaa-qa-20261122-v1`; guarded DEV PASS, superseded.
- **N7** — `3b39fbd3ebe975e611d923fb4c7df240a355383e`: Node releases explicit not-checked/empty/error states and read-only Retry. A8 `format,admin-types,ui` PASS task `pockethost-a8-night-n7-3b39fbd-qa-20261122-v1`; guarded DEV PASS, superseded.
- **N8** — `309298674040ee59f648911602ac6364740d9ff1`: read-only Refresh releases independent of full catalog, GET-only fixture. A8 `format,admin-types,ui` PASS task `pockethost-a8-night-n8-3092986-qa-20261122-v1`; guarded DEV PASS, superseded.
- **N9** — `a557f58d7cd1a92b0550362f883146cc66cebb43` / `9f92d6dc74fdfd2df4dd1f71044c08df4a4801ae`: read-only Node health and preview calls discard stale responses after project switch; fixture asserts no stale readiness and GET-only reads. A8 `format,admin-types,ui` PASS task `pockethost-a8-night-n9-9f92d6d-qa-20261122-v1`; guarded DEV PASS above.
- At checkpoint, A8 transport task/result directories were paired, with **no pending task**. Do not assume continued idle without rechecking.

- **N10** — `f8e4dda087f961e025ef7dcc651a8f5961f988ba` + final `199e8b1e6aad2c5a42355df3d40623dc152a471a`: extracted read-only Node toolchain/registry diagnostics with explicit loading/error/retry feedback, fixture-only GETs. First QA `format,admin-types,ui` failed one preexisting malformed-report message assertion; compatible message restored. Final A8 QA `pockethost-a8-night-n10-199e8b1-qa-20261122-v1` **PASS** (`format,admin-types,ui`); guarded DEV PASS, superseded by N11.
- **N11** — `c4dedfd23b597a95a96f00379786fe36f6cf27e2`: Static Hosting ZIP/folder first-import selection now shows selected source and a clear-selection control that resets native inputs without any API write. Fixture verifies both ZIP/folder, restored starter choice, no POST. A8 QA `pockethost-a8-night-n11-c4dedfd-qa-20261122-v1` **PASS** (`format,admin-types,ui`); guarded DEV PASS at latest above.
- At this checkpoint, N11 result is terminal and matched target. Re-read task/result directory before next Agent operation; no implicit retry of uncertain tasks.

## Still OPEN

Real browser Static ZIP/folder/custom HTML import, served-byte comparison and cleanup; independently created Node project acceptance; mutable-data restore; comprehensive G2 qualification; physical G3 reboot; public cutover; actual Mac Test Lab browser capture. Targeted QA and HTTP readback do **not** prove these.

## Next sprint N12

From freshly verified `main`, improve the **Node Projects creation confirmation flow** in `apps/admin/src/app/projects/page.tsx`: distinguish pending POST, verified identity/readback, definite validation failure and uncertain acknowledgement. A lost/unknown POST must not encourage duplicate project creation until an explicit catalog Refresh. Keep the owner token, host API and lifecycle approval gates unchanged. Test with fixture-only simulated GET/POST; **do not create a real project**. If the change is too broad, narrow it to pending/error feedback without weakening existing guards.

Then one exact-SHA A8 `format,admin-types,ui` task and guarded DEV only on QA PASS. Do not overlap unknown A8 tasks, rerun full suites, touch protected services, add a scheduler, public routing or real hosted data. macOS private read-only Test Lab screenshot acceptance remains independent and OPEN; no off-device screenshots.

Continuation requires the existing external Chat Bridge trigger. No work continues in the background after the chat turn ends.
