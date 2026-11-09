---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Specify the exclusive Termux Local Agent development workflow and fast start
---

# Termux Local Agent — Fast Start and Execution Contract

## Current DEV operating mode

The existing PocketHost admin panel is **DEV**. Follow
[DEV iteration runbook](DEV_ITERATION.md): small code change -> commit ->
relevant quick check -> HMR or verified PocketHost-only restart -> owner
review. Full `check:all` belongs at milestone closeout, not every
minor GUI edit. The owner has already approved normal repeated restart
of the verified PocketHost-owned DEV panel; do not request fresh approval
for each iteration. Do not create a second preview panel merely for UX.

The old foundation/setup sequence below is for **initial onboarding,
untrusted hosts or missing prerequisites**. Once the same Samsung Local
Agent, isolated source checkout and owned panel are already verified,
reuse that evidence instead of replaying full preflight and heavyweight
tests every time. Other Termux services remain protected.

## Main-only source policy

All source and documentation changes go directly to the current `PocketHost/main` unless
explicitly instructed otherwise by the owner. Detached isolated on-device QA checkouts
are allowed for exact-source tests; they must not be used as development branches.
Moving source to `main` does not activate any live services or waive release gates.

## No PocketHost project binding

PocketHost uses **ordinary Git and host-command tasks**, not Local Agent project mode. The installed Android/Termux Local Agent bundle has a bounded CLI/host-command executor. It **does not require** PocketHost project registration, a canonical project binding UUID or an Agent-managed project checkout to run CLI tools on Termux. Do not provision these just to run Git, Node/npm or tests; there is no demonstrated advantage for this project. An independent normal PocketHost Git checkout suffices.

The Local Agent itself still has an exact **host ID and installation ID**, needed to route and authorize tasks in the existing private transport. These installation identifiers are **not** a project binding. The owner reports Git and development tools installed; check versions on demand before depending on them, and do not infer a fresh runtime state from repository source.

## Binding decision

PocketHost uses the **existing Android Termux installation and its installed Local Agent** as the **only development execution host**. All commands which execute source, install dependencies, validate files, test, bundle or compile PocketHost run on **that phone via Local Agent**. GitHub Connector is used to read/edit the PocketHost repository and to publish/read the private Local Agent control-plane tasks/results; it is not a substitute executor.

Do not run PocketHost code, package installation, lint, TypeScript checks or test suites on Mac, ChatGPT Linux sandbox, Codex, ChatGPT Work or GitHub Actions. Prior sandbox results are historical foundation evidence and do not establish Termux acceptance. Documentation-only repository edits can be published without execution, but remain marked **not tested on Termux** until a real terminal result is obtained.

**Owner exception (2026-11-09):** the single PocketHost DEV admin panel may
be registered under the **existing** Termux runit manager, with a bounded
panel-only HTTP watchdog and no second Termux:Boot hook. The no-autostart
rule continues to apply to hosted applications, external services and
other PocketHost instances. The Local Agent service retains its separate
lifecycle and must not be modified by this change. See
[ADR-0014](adr/0014-termux-panel-supervision.md).

## Existing Local Agent capability

The documented Samsung/Termux Local Agent profile offers an app-private **bounded host-command task bundle** under its private runit service; automatic project-repository execution is **not established** for this profile. Therefore:

- Use an exactly targeted, authorized **host-command task** to inspect/run commands against an explicitly verified, independent PocketHost checkout on the phone.
- Do not enroll or bind PocketHost as an Agent project. The host-command lane can use the phone's ordinary Git and development CLI against an independent project directory; verify the checkout exists before project commands.
- Do not edit the Local Agent installation, its intake or control paths to add a project unless a separate qualified procedure explicitly requires it.
- The Agent executes with its Termux OS-user permissions, not root; the host-task lane is **not a security sandbox**.
- Do not silently route work through Mac, SSH to another host, or another agent if the phone is unreachable.

Canonical Local Agent references: [usage](https://github.com/MichalMatu/local-agent/blob/main/docs/USAGE.md), [host-control protocol](https://github.com/MichalMatu/local-agent/blob/main/docs/HOST_CONTROL_PLANE.md), [Termux support](https://github.com/MichalMatu/local-agent/blob/main/docs/SUPPORT.md), [operations](https://github.com/MichalMatu/local-agent/blob/main/docs/OPERATIONS.md).

## Quick start — new chat or task

1. **Load project contract.** Read root `AGENTS.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/TERMUX_INTEGRATION.md`, `docs/QUALITY_GATES.md` and the nearest module `AGENTS.md`. Start from the **actual current `PocketHost/main` HEAD**, never a historic handoff SHA.
2. **Identify one real Termux target.** Read the _current_ private Local Agent host/installation identity, task namespace, intake/status and installed support profile. An old receipt is not fresh liveness. Keep IDs/credentials out of PocketHost files and logs. If there is no confirmed usable Termux intake, mark the task **BLOCKED**, not silently executed elsewhere.
3. **Send one harmless preflight host task.** Via GitHub Connector, publish a new immutable request through the already configured private Local Agent repository on branch `agent-control`, addressed to `.agent/hosts/<host-id>/supervisor/<installation-id>/tasks/`. Use the **installed, documented payload contract** and bounded timeout/output; never invent a task schema or reuse a task ID. Read the response from the same installation's `task-results/`. Publication or `status.json` alone is not proof of execution.
4. **Verify the phone's developer toolchain.** Read-only commands: architecture, `git --version`, `node --version`, `npm --version`, and optionally `termux-info` if present. Report missing tools and compatibility (the repository currently requires Node >=22). Do not dump environment variables, credentials, private paths, all processes or all ports.
5. **Verify an isolated PocketHost checkout.** Confirm its origin, actual HEAD, working tree state and location **outside** IleStoi.pl, Local Agent installation, private transport, and their production data. If no checkout exists, choose a vacant independent location and use ordinary Git through the Termux CLI to clone PocketHost. No Agent project onboarding or binding is needed; preserve every existing directory.
6. **Run existing dependency-free gate first.** From that verified checkout, request `npm run check:foundation` through the Termux host-command lane. Capture each command's exit code and output (redacted/bounded). A passing result must refer to the exact checkout SHA.
7. **Resolve dependencies only when approved.** The initial foundation has no verified npm lockfile. First check its state. Dependency downloads/`package-lock.json` generation and future `npm ci` must happen on Termux, with an explicit reviewed dependency plan. Use `npm ci` **only after** a verified lockfile exists; run `npm run check` afterwards. Do not invoke `pkg upgrade`, globally install packages, or modify shared Termux tools merely to satisfy tests without explicit authorization.
8. **Record and publish evidence.** Read the terminal task result from private Git, distinguish `done`/`failed`/`UNKNOWN`, and record exact PocketHost source SHA, host profile (no secrets), tool versions, commands, exit codes, limitations and effects. If a result is missing or uncertain, investigate; never automatically replay the same side-effectful command.
9. **Only then proceed to implementation.** Begin with read-only discovery of existing IleStoi.pl configuration, using allowlisted, sanitized probes. Do not change, restart, stop or rebind that service or Local Agent.

### Suggested harmless preflight commands

These are **commands for the authorized Termux Agent to execute** after exact target verification; they are _not_ a ready-made Git task JSON payload:

```sh
uname -m
git --version
node --version
npm --version
command -v termux-info >/dev/null 2>&1 && termux-info || true
```

Once the separate project directory has been positively identified, the next **read-only** checks are:

```sh
git -C "$POCKETHOST_DIR" remote -v
git -C "$POCKETHOST_DIR" rev-parse HEAD
git -C "$POCKETHOST_DIR" status --short --branch
```

`POCKETHOST_DIR` is a placeholder for the **verified** project directory, not a default that can be guessed. Do not print credential-bearing remote URLs in public logs; sanitize output before publication.

Only after confirming the current checkout and execution contract:

```sh
cd "$POCKETHOST_DIR" && npm run check:foundation
# With a reviewed, generated and committed package-lock.json:
cd "$POCKETHOST_DIR" && npm ci && npm run check
```

## Task/data flow

```text
User / ChatGPT
  -> GitHub Connector: PocketHost source/docs on main
  -> GitHub Connector: private Local Agent repo, agent-control branch
  -> exact Termux host ID + installation ID / tasks/<new immutable task>
  -> Termux Local Agent: authorized bounded host command
  -> isolated PocketHost checkout on phone: tools, tests, builds
  -> Local Agent durable local result -> same installation task-results/
  -> GitHub Connector reads terminal result -> PocketHost checkpoint
```

This flow has **no project binding step**. The PocketHost repository's `main` branch is **source**, not a Local Agent inbox. The Agent's private `agent-control` namespace is **transport**, not PocketHost source. Do not commit private receipts, tokens or host configuration into PocketHost.

## Failure / recovery policy

- **No Agent availability or invalid host/installation identity:** stop, report blocked and preserve current checkout. Missing project binding is not a blocker.
- **Missing repo, Node, npm, dependency access, or lockfile:** report exact missing prerequisite; no silent substitution to Mac/sandbox.
- **Gate fails:** keep the failure and affected SHA; fix within normal PocketHost review, then re-run a new bounded task if justified.
- **Result absent or UNKNOWN:** inspect task state and durable result before issuing another command. Never replay an uncertain write, installation or build side effect automatically.
- **Detected conflict with IleStoi.pl or Local Agent:** fail closed; no restarts, process kills, config changes, port reassignment or broad filesystem cleanup.

## Minimum handoff/checkpoint record

Record: request scope, source branch/commit, explicit Termux host+installation reference (in private receipt, not public docs), verified checkout identity, task ID, published result status, tool versions, exact commands and exit codes, tests passed/failed/skipped, redacted evidence, state of IleStoi.pl/Local Agent (only if actually observed), rollback and next dependency. **Never label historical or unexecuted checks PASS.**
