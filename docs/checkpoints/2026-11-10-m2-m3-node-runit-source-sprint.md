---
status: source-implemented-validation-open
owner: hosting
last_reviewed: 2026-11-10
purpose: Single M2/M3 Node runit sprint checkpoint and exact Samsung acceptance limits
---

# PocketHost — M2/M3 guarded Node hosting sprint

## Source result

Base: `9a7d2f459fcee2412d8edfd918ac3782f8e7bf3b`.
Latest source commit before this checkpoint update: `a8720829ae0f7346b2f73767778e8775125bd8ff`.

- Reused the existing TermuxServiceAdmin and installed upstream runit.
  No replacement supervisor, system package installation, foreign-service
  adoption, new tunnel or public listener.
- Added a guarded Node runtime host: fixed private port pool, exact service
  registration and disabled-by-default one-shot start, PID/start-ticks/UID/
  argv/cwd proof, bounded logs, nonce-verified readiness, crash/failure
  refusal, attempt to restore last good release and explicit prior-good rollback.
- Added staged source SHA256 proofs. Legacy or altered candidates remain
  unavailable for execution until safely re-staged. Manual lifecycle actions
  require the separate DEV runtime flag, owner intent and explicit approval.
- Connected M1 Node module, service and project declarations through a
  read-only validated projection, with unique runit-compatible unit IDs.
  Declarations never authorize runtime ownership.
- Exposed HealthPolicy read-only decisions respecting manual stop, retries
  and cooldown; no automatic project restart was enabled.
- Extended DependencyPlan to detect missing direct lock entries, unreviewed
  non-registry package sources, lifecycle install scripts and explicit Node
  engine minimum. No dependency installation or build was attempted.
- Reused ResticWorkspaceAdmin for an independently scoped encrypted Node
  repository, with explicit approval gates and staging-only restore.
  Refused unexpected files, symlinks, in-flight source/deploy actions and
  snapshots of transient locks. Existing H3/system Restic defaults remain.
- Source create, stage, restore, runtime start/stop and backup coordinate on
  the same private exclusive mutation lock; crash-stale locks fail closed.
- Wired Projects, Deployments and Runtime Logs screens to bounded Node APIs,
  including plan, Node/npm versions, approval, active rollback, journal,
  logs, registry projection and read-only Restic status. Retained H1 demo,
  H2 static hosting and existing panel routes.
- Added focused Node negative/source-integrity/registry and React API/page
  tests. Their presence in Git is **not** a passing test result.

## Verified Samsung evidence

At exact source `375f56a70bff707cd89fed7bd7e844056b033169` the
Samsung Termux Local Agent returned:

- Node targeted tests: **10/10 PASS**.
- React project interaction: **1/1 PASS**.
- Lint, structure, module boundaries and documentation checks: **PASS**.
- Root and admin TypeScript: **FAIL** (one stale three-argument call to
  the two-argument observed-process method). Source repaired subsequently.
- Prettier: **FAIL** for four changed source/test files.
- The complete gate therefore remained **OPEN**.

A subsequent exact-SHA Samsung check could not be published through
the available control connection. It was not executed; no new PASS
exists for the latest source. Preserve this as an explicit QA blocker.

## Acceptance and next action

Execution, build/install, real runit service registration, first start,
process attribution, readiness and active rollback on a disposable
Samsung-owned Node project remain **PHYSICAL_OPEN**. The code still
executes user Node source as the same Termux OS user, not in an
independent sandbox. Only explicitly trusted disposable source is
suitable for the first approved hardware trial.

Immediate next action: run targeted TypeScript, lint, Prettier, the
changed Node and Vitest tests at **one verified current main SHA on
Samsung**. Repair failing gates. Then test one explicitly authorized
zero-dependency disposable release: ownership, once/start, local
readiness, Stop, failed update recovery and rollback. Keep runtime
feature flag off until those safeguards are accepted.

Controlled npm dependency installation/build and **physical** scoped
Restic backup/restore acceptance remain open. The source-only Restic
adapter is not a verified physical backup. M4 Python/SSH/Cloudflare
and M5 multi-component hosting are deferred while M2/M3 runtime
acceptance is open. Rough source-progress estimates: M2 ~50%, M3 ~55%,
M4 0%, M5 0%; **none are accepted device milestones**.

## Continued M3 source iteration — 2026-11-10

- `22ef491b9f34c07925ae903e6bd34491cbc0b988` adds an attested,
  current-candidate-only source read in the host module and private API,
  with a React editor load action. LAN-gateway reads of source are denied.
  Switching projects clears the previous project's draft from the editor.
- `fec1cae838c2a233324df943c8c9e5188cf4fac9` adds a read-only Node
  HTTP health check that retains a single exact PID/start-ticks/release/nonce
  identity across its loopback probe, plus React readiness inspection.
- Source and UI regression cases were added for these features; source commits
  are **not** native PASS. An exact-source Samsung Termux targeted check for
  `22ef491b9f34c07925ae903e6bd34491cbc0b988` was published with task ID
  `pockethost-m3-candidate-editor-22ef491-20261110-v1` but no terminal
  result had been observed at this checkpoint. The subsequent health commit
  has not been tested on Samsung.
- No hosted Node service, tunnel, package installation, new boot service or
  foreign process was started, stopped or modified in this continuation.
  **PHYSICAL_OPEN** remains the first authorized disposable runit start,
  local readiness observation, Stop, failed-update recovery and rollback.

Next: consume the outstanding Samsung receipt, fix concrete failures, then
run the narrow changed-file checks at the latest exact source SHA before
any live runtime acceptance. Do not duplicate a still-pending host task.
