---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Single-pass DEV update with owner-controlled testing
---

# FAST FLOW: code → deploy → verify

1. Commit one coherent change on fresh `main`; read the actual live PocketHost panel SHA and verify its ownership. Do not infer it from Git history.
2. In **one** verified Samsung Termux Local Agent task, reuse the existing clean QA checkout, fetch/pin the exact target and use cached dependencies.
3. Run `node ops/termux/fast-flow.mjs --base=<live-sha> --target=<target-sha> --apply`. Default: **no QA suites, format/lint/typecheck or route smoke**. It performs strict source/owner checks, read-only preflight, guarded PocketHost-only refresh with rollback, then read-only live revision/health verification.
4. Read **one terminal JSON receipt**. Deployment PASS requires exact live target SHA, health, unchanged protected services and successful guarded refresh. Missing receipt or failed safety gate = HOLD, **no automatic retry**.

**Tests only on explicit owner instruction:** add `--tests` to that same command *only after* the owner says it is time for tests. The optional focused QA runs before guarded deployment; it is never scheduled automatically.

**Docs-only:** commit to Git; no automatic Markdown check, build, restart or deployment. Privileged/unknown ownership remains HOLD rather than a bypass. No service installs, WAN exposure or unrelated process changes. Samsung only, never CI/Mac/sandbox.


## Owner-authorized end-to-end flow qualification

When the owner explicitly requests a full flow test, include `--tests` on
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
