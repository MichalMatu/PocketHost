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

## Installed boundary

Termux Agent uses its app-private runit installation and private Git checkout. Local project service endpoints such as `/api/v1/termux-admin` are **not** enrollment or Git task transport. The admin Local Agent view provides sanitized diagnostics, not a substitute for an authoritative private Git result.

Only a positively owned PocketHost DEV panel may be refreshed/restarted under its guarded runit/rollback contract. Preserve independent H2 static Hosting, IleStoi, PhotoMap, SSH, Cloudflare, Mosquitto, Local Agent and all unrelated data.

See [FAST FLOW](DEV_ITERATION.md), [root AGENTS](../AGENTS.md) and the private Local Agent `docs/HOST_CONTROL_PLANE.md` / `platforms/android/local-agent/README.md` for transport and Termux contract details.
