---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Current verified night sprint evidence, exact deployed SHA and next safe code slice
---

# PocketHost — current handoff

**Plan:** [night autonomous sprint](NIGHT_AUTONOMOUS_SPRINT.md). **Prior checkpoint:** [post-demo cleanup](checkpoints/2026-11-22-demo-cleanup-overnight-handoff.md). **Mandatory:** [root AGENTS](../AGENTS.md), [A8 transport](LOCAL_AGENT_TERMUX.md), [FAST FLOW](DEV_ITERATION.md), [MVP acceptance](MVP_EXECUTION_PLAN.md).

## Verified source, QA and DEV

- Last code snapshot before this documentation-only handoff commit: `7bd95db167977bf15018170d69574905a6a2101f` on `PocketHost/main`. Re-read fresh main and immutable A8 receipts next turn; this document is not a live device poll.
- **Latest A8 DEV guarded DEPLOY PASS:** `97fccbcbdfca4704a56cf234d722fac3bae95ac8`, task `pockethost-a8-night-n4-97fccbc-deploy-20261122-v1`. Owned PID `11454`, start ticks `73435287`, loopback HTTP `200`, protected services unchanged, tests `not-run` in deploy. No subsequent panel restart for docs or Test Lab source.
- **N1 QA mapping:** `b161a5a` + `83063b7` code; targeted A8 syntax, format, structure, root lint and Node evidence PASS across the pinned receipts. N1 guarded DEV PASS, later superseded.
- **N2 Static create/import:** `1c114cfe4047ab386dcdcf63b50800ae1530d05f`; extracted exact-site readback and added pending/duplicate-submit regression. A8 `format,admin-types,ui` PASS, guarded DEV PASS.
- **N3 Node Projects selection readback:** `3d79d2c` + fixture `2739e4c` + unused-import correction `803cf7528505f797b349e71b92fb2b8f226583c2`. A8 `format,admin-types,ui` PASS at final code; guarded DEV PASS, superseded by N4.
- **N4 raw Local Agent console:** `73c2827` + fixture `3c99b1c` + test repair `97fccbcbdfca4704a56cf234d722fac3bae95ac8`. A failed refresh now retains original raw source lines; an explicit retry uses the existing browser poll mechanism. A8 format and admin TypeScript PASS at `3c99b1c`, targeted format/UI PASS at `97fccbc`; guarded DEV PASS above. No new Agent process or poller.
- **N5 read-only Test Lab tooling:** `92e1756` and formatted/lint-corrected `7bd95db167977bf15018170d69574905a6a2101f`. Added local bottom-of-page screenshots, document-height geometry and shared strict screenshot-name validation. A8 `syntax,format,structure,root-lint,node` QA **PASS** at `7bd95db`, task `pockethost-a8-night-n5-7bd95db-qa-20261122-v1`. **No DEV deploy/restart warranted** for isolated Test Lab tools; no Mac capture, off-device screenshot publication or private LAN transfer performed. Actual Mac browser qualification remains OPEN and needs current exact source/live panel origin scope, not stale 19 November endpoints.

**Not accepted:** true browser ZIP/folder/custom HTML create/import with served-byte equality and verified cleanup; independent Node project end-to-end; mutable application data recovery; broad G2 build/coverage; physical G3 reboot; public cutover and new visual-test Mac acceptance. Do not infer these from scoped QA or runtime readback.

## Next code slice — N6

From fresh `main`, improve the existing read-only **Node Projects log feedback** at `apps/admin/src/app/projects/page.tsx`: old `/logs` responses can outlive a deep-link project selection. Extract a bounded scoped log reader that invalidates pending reads on project switch, preserves real original log lines and shows loading/error state; add fixture-only interaction regression. Preserve owner token/API and all existing stage/deploy guards. Then run separate exact-SHA A8 focused `format,admin-types,ui` checks and only guarded DEV deploy after PASS. If any task is pending/unknown, do not queue overlapping device work; progress an independent source-only slice instead.

Chat Bridge continuation requires the existing external trigger. Do not add schedulers, Actions, Codex/Work, unrelated service operations, WAN/DNS/tunnel updates, physical reboots or writes to real hosted sites/databases. Docs-only handoff updates require no build, QA or restart.
