---
status: active
owner: core
last_reviewed: 2026-11-09
purpose: Exclusive Samsung Termux Local Agent execution and exact-source evidence
---

# PocketHost Local Agent — Termux

## Execution contract

PocketHost development commands, installs, tests, lint, builds and
compilation execute **only on the precisely selected Samsung
Termux installation via its installed Local Agent**. GitHub
Connector reads/writes the source repo and transports immutable
requests/results through the private Local Agent control repo.
Mac, ChatGPT Linux sandbox, GitHub Actions, Codex and Work are
not alternative PocketHost executors.

The existing Agent uses bounded **host-command** tasks.
No PocketHost Agent project binding, registration, new worker,
second clone or special checkout schema is required. An
independent ordinary PocketHost Git checkout suffices.
An exact Agent **host ID and installation ID** are still
mandatory task-routing identities; read them from fresh private
evidence, not a historic receipt. Keep them and private paths
out of public docs and logs.

## Memory limits for screenshot and browser tasks

- The 2026-11-12 nine-screen audit was **killed by a 1300 MiB task override**
  (`command_memory_limit`, observed RSS 1344 MiB), **not by a time limit**.
- Set explicit `memory_limit_mb: 2560` on bounded screenshot/Chromium
  tasks for the Samsung with approximately 3.5 GiB free RAM. Never copy the
  old 1300 MiB override into browser tasks. Capture one screen at a time,
  do not launch competing browsers, and respect foreign services.
- The matching Termux-only Agent default is defined in
  `MichalMatu/local-agent` (its runtime must be **installed** for the
  default to change). Explicit per-task values still take precedence; the
  effective value appears in each Local Agent terminal receipt.
- Before heavy browser captures, check current available device memory and
  abort with a clear HOLD if insufficient. A higher cap does **not** create
  RAM or remove Android OOM risks. No service restart is implied.

## Fast resumption of an established session

1. Read [START_HERE](START_HERE.md), root AGENTS.md and the
   closest scoped AGENTS.md; verify **fresh PocketHost/main**.
2. Inspect current private Agent host/installation, available
   task intake and **existing pending/results** before creating
   a new task. A task being published is not a terminal result.
3. Reuse the verified Samsung project checkout and toolchain
   if unchanged. Confirm clean source and exact HEAD; avoid
   onboarding, dependency reinstall and full device preflight.
4. Preview the [changed-file test plan](DEV_ITERATION.md)
   against the last verified SHA. Execute the narrow plan
   via a bounded, precisely addressed host-command task.
5. Read the durable terminal result from the same installation.
   Record tested SHA, command, exit code, affected checks and
   skips. UNKNOWN is not PASS and must not trigger an unsafe
   automatic replay.
6. Use Vite HMR for simple UI work, or a PocketHost-only
   verified panel restart if required. **Docs-only tasks never
   need a panel restart.**

## Fresh host or missing prerequisites

For first setup, suspected host changes or missing prerequisites,
perform one harmless read-only preflight (architecture, git,
node, npm and optional termux-info version). The repository
currently requires **Node >=22**. Confirm the checkout is
outside Local Agent, IleStoi.pl and other managed site paths,
and that its origin/working tree/HEAD identify PocketHost.
Then run the dependency-free foundation gate through Local
Agent once. Install dependencies only with a reviewed lockfile
and actual need; never auto-upgrade global Termux packages
or substitute a Mac/sandbox result.

No host scan outside agreed paths, credential/environment dump,
unapproved service operation, tunnel or DNS modification.
Normal PocketHost DEV panel runit autostart/recovery is the
only owner-approved exception and never extends to sites or
foreign services.

## Transport and acceptance

The verified private control namespace is
**MichalMatu/local-agent** on **agent-control**. Task requests
are addressed to the particular host/installation supervisor's
tasks directory; durable results return to that installation's
task-results directory. Use the **actual installed payload
contract**. Do not invent a JSON schema, target, cwd or task ID.
The control repo is private transport, not PocketHost source.

Task intake may be temporarily unavailable even when old
results exist. Do not interpret a historical result as
fresh heartbeat/liveness or an absent result as a safe retry.
Limit command duration/memory/output and avoid printing tokens
or raw private host paths.

A source commit does not deploy the phone or modify services.
For exact-source hardware claims, require an observed terminal
receipt and the correct process ownership, state and SHA;
for public releases, separately run the applicable physical
G3 acceptance. See [quality gates](QUALITY_GATES.md),
[DEV FAST FLOW](DEV_ITERATION.md), and the private Agent
[host control contract](https://github.com/MichalMatu/local-agent/blob/main/docs/HOST_CONTROL_PLANE.md).

## Prohibited interference

Never stop, migrate, restart, adopt or rebind IleStoi,
PhotoMap, Local Agent, SSH, Cloudflare or other Termux
services as a side effect of PocketHost development.
A discovered service, matching PID or open port is not
an ownership record. Preserve host recovery and
rollback; signal only positively owned PocketHost processes
under the specific owner-approved scope.
