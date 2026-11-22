---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Standing owner QA permission with separate guarded code/deploy/test execution
---

# FAST FLOW: code → deploy → verify

**Standing owner QA consent (2026-11-22, valid for every subsequent PocketHost sprint until revoked):** the owner explicitly approves necessary non-destructive tests, QA, lint, formatting, typechecks and build checks while developing autonomously, including when the owner is asleep or unavailable. **Do not request renewed consent for each test, category, commit SHA, iteration or sprint.** Select relevant checks intelligently, execute only on the paired Samsung A8, and report their exact scope and results. No scheduler, unattended recurring run, GitHub Actions, CI, Codex/Work or automatic retry of an uncertain device task. Owner approval for routine QA never implies approval for destructive operations, external services, real customer data or public network changes.

## Guarded deployment — QA remains a separate step

1. Commit one coherent code change to fresh GitHub `main`, then read actual A8 DEV live SHA and verified owner identity. Reuse the existing clean isolated A8 QA checkout and cached dependencies; never reinstall packages on each iteration.
2. Publish **one** bounded A8 Local Agent task with exact base and target. Execute `node ops/termux/fast-flow.mjs --base=<live-sha> --target=<target-sha> --apply`. **There is no `--tests` option.**
3. The deployment script checks only Git SHA ancestry, clean checkout, panel ownership, protected-service isolation and rollback eligibility. It performs the guarded PocketHost DEV-only refresh and reads back live SHA/owner/basic HTTP. These are **safety and release verification, not functional tests**.
4. Report exactly one terminal deployment receipt (PASS/HOLD, target SHA, owner/health, protected services, `tests=not-run`). If the agent is unavailable, state is uncertain or a gate fails, **HOLD and no automatic retries**. After a verified deployment, select only useful targeted checks and run them **separately** under standing QA consent; a successful deployment is never QA PASS.

**Docs-only commit:** GitHub update only; do not restart or redeploy the panel. QA of document changes is optional under standing consent, and must not trigger a panel update.

## Standing authorized, separate targeted QA

The deployment command can **never** start tests, even with an accidental `--tests` flag. `changed-checks.mjs` and `verify-changed.mjs` remain **read-only planners** unless the runner receives explicit execution arguments. Standing owner consent permits the active assistant to derive the exact SHA and chosen categories for a relevant one-shot QA task, without further questions. The execution flags protect against checkout drift or unintended categories; they are **not** a requirement for new human approval. Run on verified A8 only:

```sh
node scripts/dev/verify-changed.mjs --base=<verified-prechange-sha> --execute --approved-head=<exact-40-hex-target-sha> --approved-checks=docs,node
```

For **post-deployment QA** where the target SHA is already live, `--base` must be a verified pre-change ancestor of that target, **not** the current live SHA itself. Otherwise the planner reports `NO_CHANGES` and that result is not functional QA. Always pin the clean A8 QA checkout at the separately approved target SHA; `main` may contain later documentation-only commits.

Replace `docs,node` with the **agent-selected and recorded** applicable check categories: `format,structure,boundaries,docs,markdown,root-lint,admin-lint,root-types,admin-types,node,ui,syntax`. Inspect the planned files, avoid unnecessary broad suites and use the exact SHA for **each run**. Missing, duplicate or drifted categories/SHA are refused by the runner. Do not reuse execution flags for an unknown task or changed source: pin the new SHA and re-evaluate the relevant checks under the same standing consent. `changed-checks.mjs --run` and `fast-flow.mjs --tests` are rejected. A QA failure generates a bounded receipt, does not deploy anything and never retries automatically.

The manual planner orders cheap formatting, documentation, structure and lint checks before TypeScript and costly Node/UI tests; it collects inexpensive failures and skips expensive suites after a cheap failure. Reuse existing QA files and receipts; do not repeat entire passes merely to extract diagnostics. A test failure may be fixed in a new focused code commit followed by a new guarded deploy and an appropriately pinned one-shot QA run; **no further owner question** is required for ordinary non-destructive verification.

## Stage acceptance

Code completion and release readiness are separate from test approval. If a stage needs non-destructive regression evidence, run the relevant scoped QA under standing consent and report the receipt. Never mark it OWNER ACCEPTED without actual confirmation. Physical reboot, external SSH/WAN operations, unrelated services, sensitive/real data, unowned processes, destructive restoration and other disruptive operations require additional specific consent.

**Operational invariant:** keep protected-service gates, owner marker/PID/start ticks, rollback, exact-SHA source verification and basic loopback HTTP even with tests disabled. Never remove these safety controls to shorten the flow.
