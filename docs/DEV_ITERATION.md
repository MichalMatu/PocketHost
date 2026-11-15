---
status: active
owner: core
last_reviewed: 2026-11-15
purpose: Permanent no-automatic-tests FAST FLOW policy
---

# FAST FLOW: code → deploy → verify

**Every mode is NO-TESTS by default, indefinitely.** The prior broad authorization for tests on completed stages is revoked as of 2026-11-15. Completion of a stage, request to continue, audit, fix, release or deploy **does not authorize testing**. Ask for a new, explicit, scope-specific approval **before each manual test execution**. No independent recurring tests, periodic checks, CI, schedulers or GitHub Actions. Keep existing test code for later opt-in use; do not delete coverage to gain speed.

## Default deployment — no QA

1. Commit one coherent code change to fresh GitHub `main`, then read actual A8 DEV live SHA and verified owner identity. Reuse the existing clean isolated A8 QA checkout and cached dependencies; never reinstall packages on each iteration.
2. Publish **one** bounded A8 Local Agent task with exact base and target. Execute `node ops/termux/fast-flow.mjs --base=<live-sha> --target=<target-sha> --apply`. **There is no `--tests` option.**
3. The deployment script checks only Git SHA ancestry, clean checkout, panel ownership, protected-service isolation and rollback eligibility. It performs the guarded PocketHost DEV-only refresh and reads back live SHA/owner/basic HTTP. These are **safety and release verification, not functional tests**.
4. Report exactly one terminal receipt (PASS/HOLD, target SHA, owner/health, protected services, `tests=not-run`). If the agent is unavailable, state is uncertain or a gate fails, **HOLD and no automatic retries**. No extra build, smoke route checks, lint, formatting, typecheck or UI/API regression.

**Docs-only commit:** GitHub update only; no agent job, format/Markdown checks, build, restart or panel update.

## Explicitly authorized, separate manual QA

The deployment command can **never** start tests, even with an accidental `--tests` flag. `changed-checks.mjs` and `verify-changed.mjs` are **read-only planners** unless the latter receives a double opt-in. If the owner explicitly requests a _specific_ QA run for a _specific_ target SHA, run on verified A8 only:

```sh
node scripts/dev/verify-changed.mjs --base=<verified-live-sha> --execute --approved-head=<exact-40-hex-target-sha>
```

The agent must have fresh human approval **before constructing this command**; flags are not proof of permission. An approval applies to **one run only** and is not inherited by a different SHA or a subsequent attempt. `changed-checks.mjs --run` and `fast-flow.mjs --tests` are rejected. A manual QA failure generates a bounded receipt, does not deploy anything and never retries automatically.

The manual planner orders cheap formatting, documentation, structure and lint checks before TypeScript and costly Node/UI tests; it collects inexpensive failures and skips expensive suites after a cheap failure. Reuse existing QA files and receipts; do not repeat entire passes merely to extract diagnostics.

## Stage acceptance

Code completion and release readiness are separate from test approval. If a stage needs physical functionality or regression evidence, report the exact missing evidence and ask the owner whether to run a named manual check. Never mark it ACCEPTED without confirmation. Physical reboot, SSH, WAN, external services, sensitive data and other disruptive operations each require additional specific consent.

**Operational invariant:** keep protected-service gates, owner marker/PID/start ticks, rollback, exact-SHA source verification and basic loopback HTTP even with tests disabled. Never remove these safety controls to shorten the flow.
