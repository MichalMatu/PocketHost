---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Exclusive Samsung host executor and private Git task/result runbook
---

# Samsung Termux Local Agent

Only the **explicitly selected, verified Samsung Termux installation** runs PocketHost builds, guarded panel updates, read-only verification and tests authorized by the owner. Never route to Mac, sandbox, Codex, Work or GitHub Actions.

## GitHub Connector: actual task transport

The agent is **not** a direct shell tool in ChatGPT. Its transport is the private `MichalMatu/local-agent` repository on branch **`agent-control`**, **not** the PocketHost `main` branch. The GitHub Connector can read task/result files and, when explicitly asked to execute a task, publish immutable task JSON through ordinary Git tree/commit/ref writes. No SSH relay, GitHub Actions or additional scheduler is needed.

For the exact Samsung installation, discover its already-established `host-id` and `installation-id` from an existing verified task/result pair, never from guesswork or another machine. The addressed inbox and result paths are:

- `.agent/hosts/<host-id>/supervisor/<installation-id>/tasks/<task-id>.json`
- `.agent/hosts/<host-id>/supervisor/<installation-id>/task-results/<task-id>.json`

A v1 host task uses `mode: "commands"`, `target_host_id`, `target_installation_id`, explicit `cwd`, bounded `commands`, `resources`, `command_timeout`, `task_timeout`, `idle_timeout`, `memory_limit_mb` and `output_policy: "summary"`. The known PocketHost reservation resource is `repository:pockethost`. Preserve every field's actual installed-schema constraints; consult a comparable previous immutable task before publishing.

## Execute once, receive once

1. Read the current `PocketHost/main` exact source SHA and the selected `local-agent:agent-control` HEAD. Inspect any previous task with the same goal, its result and outstanding work; never duplicate a pending request.
2. On an explicit operation request, publish **one new immutable task ID** as a new JSON file in the exact Samsung inbox in **one non-forced Git fast-forward**. Use the GitHub Connector's tree, commit and expected-SHA ref update. Never edit an old task, supervisor control clone, task result, local claim, STOP or installation identity.
3. For PocketHost deployment, the task itself must execute the owner's one-pass **code → deploy → verify** flow on the already verified Samsung. Fetch/pin the exact `main` target in the existing clean QA checkout; require genuine live-panel ownership, process/source, protected-service and rollback gates. Invoke `ops/termux/fast-flow.mjs --base=<verified-live-sha> --target=<exact-target-sha> --apply`. Never assume a Git source commit was deployed.
4. **No tests by default.** Do not invoke `--tests`, format, lint, typecheck, docs checks or smoke suites unless the owner explicitly requests tests. The deployment preflight and read-only live-SHA/health confirmation remain mandatory operational safeguards.
5. Read the specific task-result path on the same private Git branch. Confirm the immutable ID, target host/installation, terminal `status`, command `exit_code` and its JSON `output`. For deployment PASS, require the nested exact-source receipt, actual live SHA, guarded refresh, healthy panel and unchanged external services. A queue commit, `done` alone or historic receipt is insufficient.
6. Missing result = **unknown/pending**, not permission to replay. An interrupted or ambiguous command must never be resent with another ID as an automatic retry. Do not operate on unrelated services, expose the private LAN panel publicly or read raw secrets into task outputs.

## Performance watchdog (optional Termux release)

The Local Agent menu shows event-driven execution durations from the
**selected Samsung** private state when its installed Termux bundle supports
`observability/task-latency-v1.json`. The same existing read-only diagnostic
GET exposes a sanitized aggregate of at most 40 task samples: last duration,
median, p95 and the last 10 result statuses, plus fixed-code warnings.
The API never serves task IDs, paths, commands or the private history file.

Alerts for recent UNKNOWN/timeouts, repeated execution above five minutes,
or doubling relative to earlier samples require recorded evidence. An absent
history is **not healthy**; it is explicitly missing/uninstrumented. The menu's
existing visible-page GET interval does not create another Agent poll or
persistent watcher. Closing the page means no browser alert delivery.
It does not measure queue-to-start or Git result delivery delay. Mac Local
Agent history is on another machine and **not** claimed by this panel.
Independent dead-process detection and off-page notification remain an
uninstalled, separately qualified capability.


## Current installation selection: Galaxy A8

The owner selected the **already-paired Galaxy A8 only** for PocketHost execution. Get exact private host and installation IDs from an authenticated A8 task/result, never use S22 identities. A8 Node/npm, isolated PocketHost checkout, owned runit panel and watch were installed with terminal PASS on 14 November 2026; guarded FAST FLOW updates passed. Latest confirmed live panel SHA: `d003b199ccc89d7c4e85798c6d6c2f4b17a14bf1` (2026-11-15, HTTP 200, PID 6412, tests not run; private task `pockethost-a8-service-lifecycle-log-explorer-20261115-v1`). GitHub `main` can advance for docs-only changes without deployment. [Active handoff](HANDOFF_NEXT_CHAT.md).

The installed A8 **Local Agent** bundle, confirmed independently by private task `pockethost-a8-agent-bundle-identity-20261114-v1`, is **`c39cd958c76cca0aaf2d30a654bdc4305c0a3228`**; runit was running. The newer Termux Git-poll historical-result lookup optimization at source `4d58ae544a1d7d73a6235e6b067152a605bb9635` is **not present in this installed release**. Do not mistake source availability or successful Git intake for a deployed Agent upgrade. An Agent update must use a separately approved, external operator with rollback and exact source acceptance; never self-update/restart it using its own immutable task.

The standard Termux runit supervisor and A8 PocketHost-owned panel/watch services are running; `sshd` and `ssh-agent` remained disabled, external and not adopted. A separate boot hook was configured for runit, but boot recovery has not been physically verified. No new periodic scheduler was added.

## Installed boundary

Termux Agent uses its app-private runit installation and private Git checkout. Local project service endpoints such as `/api/v1/termux-admin` are **not** enrollment or Git task transport. The admin Local Agent view provides sanitized diagnostics, not a substitute for an authoritative private Git result.

Only a positively owned PocketHost DEV panel may be refreshed/restarted under its guarded runit/rollback contract. Preserve independent H2 static Hosting, IleStoi, PhotoMap, SSH, Cloudflare, Mosquitto, Local Agent and all unrelated data.

See [FAST FLOW](DEV_ITERATION.md), [root AGENTS](../AGENTS.md) and the private Local Agent `docs/HOST_CONTROL_PLANE.md` / `platforms/android/local-agent/README.md` for transport and Termux contract details.
