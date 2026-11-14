---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Single-pass DEV update with owner-controlled testing
---

# FAST FLOW: code → deploy → verify

**A8 cold-bootstrap gate: PASS on 14 November 2026.** Initial live SHA `1234603ed7c356cb6c05f57aacfcf260e79e4f5b`, runit panel/watch and loopback HTTP 200 were independently read back from the A8 Agent. Future changes must use a separate clean A8 QA checkout and a verified A8 live owner. The retired S22 QA path and marker must never be used. No default tests during interim code work; owner authorization now covers focused testing at complete-stage closure under MVP plan.

1. Commit one coherent change on fresh `main`; read the actual live PocketHost panel SHA and verify its ownership. Do not infer it from Git history.
2. In **one** verified Samsung Termux Local Agent task, reuse the existing clean QA checkout, fetch/pin the exact target and use cached dependencies.
3. Run `node ops/termux/fast-flow.mjs --base=<live-sha> --target=<target-sha> --apply`. Default: **no QA suites, format/lint/typecheck or route smoke**. It performs strict source/owner checks, read-only preflight, guarded PocketHost-only refresh with rollback, then read-only live revision/health verification.
4. Read **one terminal JSON receipt**. Deployment PASS requires exact live target SHA, health, unchanged protected services and successful guarded refresh. Missing receipt or failed safety gate = HOLD, **no automatic retry**.

**Tests at completed-stage closure (authorized 2026-11-14):** add `--tests` on the pinned guarded A8 FAST FLOW task **only when a whole MVP stage is functionally ready for acceptance**. Focus on positive/negative UI/API/host and scoped regression before guarded deployment. Do not run tests on interim partial slices or start any recurring job. Real reboot, SSH/external service changes and other disruptive tests still need separate approval. See [MVP acceptance plan](MVP_EXECUTION_PLAN.md).

**Docs-only:** commit to Git; no automatic Markdown check, build, restart or deployment. Privileged/unknown ownership remains HOLD rather than a bypass. No service installs, WAN exposure or unrelated process changes. Samsung only, never CI/Mac/sandbox.

## Owner-authorized end-to-end flow qualification

At the end of each fully implemented stage, per the owner's explicit consent, include `--tests` on
that **single** pinned Samsung deployment task. The changed-source gate
runs focused structure, syntax, typecheck, relevant Node/UI interaction tests,
format/lint and changed documentation checks **before** any live update.
For real device acceptance, inspect the installed source and protected
service state, and request read-only local/LAN route checks only under the
same explicit test authorization. Do not run a full unrelated audit.

The one JSON receipt identifies `failedStage`, bounded failure reason,
`timingsMs.prerequisites`, `timingsMs.preflight`,
`timingsMs.tests`, `timingsMs.deployment` and
`timingsMs.readback` where reached. On FAIL/HOLD preserve exact source,
existing checkout, prior receipts and rollback; do not silently retry an
uncertain deployment. A Git task `done` must include command exit 0 and
an inner `PocketHostFastFlow` PASS to count as a deployed PASS.

The Git task queue is the remote execution transport, not the panel's
runtime. Measure queue/publish delay separately from on-device test and
release times using request/result commit timestamps. The selected
Samsung agent release is an independent product; updating that service
must be handled by an independent operator, never this flow.

On a failed QA stage, inspect the existing private
`.tmp/verify-changed-last.json` receipt in the pinned Samsung QA checkout.
It includes the exact failed check and bounded error. Do not repeat an
entire test pass just to retrieve diagnostics.

## Stage closure and user handoff

A deployment PASS is **not** a complete MVP stage. When the current stage is functionally complete: run the focused A8 `--tests` gate (and any safe, explicitly approved additional test scenarios), collect exact test names/counts PASS/FAIL/SKIP plus coverage gaps, verify the owned live revision and protected-service isolation, refresh only the PocketHost-owned A8 panel, check loopback HTTP and private LAN availability, and present a concise report with commit, live SHA, verified owner/PID, test results, caveats and a MacBook URL. The user refreshes their own browser tab. Mark the tracker stage `READY_FOR_ACCEPTANCE`; `ACCEPTED` only upon explicit owner approval. If a required test is blocked, say HOLD, not DONE. Docs-only commits never trigger deploy/restart.
