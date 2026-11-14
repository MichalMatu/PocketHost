---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Exact next-session entry: A8 clean bootstrap, then PocketHost product development
---

# PocketHost — Galaxy A8 next session

**Selected device: Samsung Galaxy A8. PocketHost on S22 is retired.** The [closed S22 checkpoint](checkpoints/2026-11-14-s22-retired-a8-bootstrap-handoff.md) records the final PASS, retained historic code/sites and the independent IleStoi/PhotoMap boundary. Do not resume S22 cleanup or restore deleted S22 recovery archives by default.


## Verified final reaudits (14 November 2026)

Final S22 receipt `s22-ilestoi-final-readonly-closeout-20261114-v2`: **PASS**, IleStoi live/ready HTTP **200**, `wreckscanner`, `ilestoi-healthwatch`, `cloudflared`, `sshd`, `mosquitto` all RUN; `wreckscanner-backup` DOWN (legacy Restic repo/password absent); `pockethost-panel` and `pockethost-panel-watch` **not registered**, PhotoMap POC and managed wrapper absent. S22: **161.19 GiB free** at measurement. History-only `~/IleStoi-Backups` remains and does **not** provide a confirmed full off-device current IleStoi recovery.

Legacy-name inspection `ilestoi-s22-wreckscanner-legacy-name-mapping-readonly-20261114-v1` and `ilestoi-s22-legacy-runtime-dependency-details-readonly-20261114-v1`: **PASS**. `WreckScanner` is still a *live technical name* (project path, runit `wreckscanner`, SQLite `wreckscanner.sqlite3`, `WRECKSCANNER_*` env keys and old domain aliases), and should **not** be renamed on S22. Runtime checkout SHA `b31b8f57684a1ff0e916de5f6e6146a78faaa831` is **16 commits ahead** of GitHub `ilestoi/main` SHA `ea1b300351d6519ba387d08cb22d6aea2b204d2c`; do not mistake repository main for current deployed production. Documentation-only draft [IleStoi PR #40](https://github.com/MichalMatu/ilestoi/pull/40) is deliberately **not merged** pending separate production-history reconciliation. No more S22 cleanup or production tasks are part of this PocketHost handoff.

Final A8 receipt `pockethost-a8-handoff-final-readonly-20261114-v2`: **PASS**. A8 Local Agent processed the task; Git 2.56.0, Python 3.14.10, bash/curl/sv installed; **Node/npm absent**, `~/Projects/` empty, **16.99 GiB free** of 24.4 GiB, no listeners on selected PocketHost DEV ports. `sshd` and `ssh-agent` runit statuses unknown; do not infer services are ready. No PocketHost code has been cloned or deployed on A8 yet. [Expanded final checkpoint](checkpoints/2026-11-14-final-s22-reaudit-a8-local-agent-handoff.md).

## 1. First action: A8 cold install, not S22 migration

1. Read fresh `PocketHost/main` SHA, [root AGENTS](../AGENTS.md), [minimal entry](START_HERE.md) and [Termux Local Agent protocol](LOCAL_AGENT_TERMUX.md). Use the **verified existing A8 host and installation** discovered from the private task/result pair `pockethost-a8-handoff-final-readonly-20261114-v2` (or the earlier baseline), not S22 identifiers or a guessed host.
2. Read a **fresh A8** read-only preflight of its actual Termux home, Local Agent ownership, service supervisor, installed packages, ports, disk and Git remote. Prior observation: no PocketHost checkout, Git and Python present, **Node/npm absent**, ~16.99 GiB free; `sshd` runit status unknown. Do not mistake a working Git task intake for a running `local-agent` runit unit.
3. Install compatible Node.js **>=22 and npm** on A8 only, with adequate free space. Prepare a fresh clean `PocketHost/main` checkout pinned to exact GitHub SHA; do not clone S22's outdated QA or config. Install only needed dependencies locally and inspect resource usage before builds.
4. **Fix/implement the first-install contract before activation.** Existing `panel-owner.mjs` requires old S22-style owner marker files; `fast-flow.mjs` expects the old `PocketHost-H3-QA-20261107` and a running prior panel. These are incompatible with a bare A8. Introduce a bounded, fail-closed bootstrap path that creates **new A8-owned markers** and separate disabled runit definitions. Do not infer ownership from an occupied port, and never adopt unrelated processes.
5. Stage, then activate only A8 PocketHost with the guarded `ops/termux/install-panel-services.sh` contract after dependencies, supervisor and loopback port checks pass. Keep UI **private LAN/loopback only**; no Cloudflare/public exposure, credentials copied from S22, scheduler or unrelated service operations. Read back source SHA, service owner root, PID/start ticks, loopback health, log path and protected A8 services. One terminal task/result with exact deployed SHA constitutes A8 installation completion; task submission alone does not.
6. If a safety prerequisite fails, return **HOLD with cause**, preserve the A8 state and do not bypass the guard or automatically retry. Tests/smoke suites are **not part of the default flow** unless the owner explicitly requests them; mandatory read-only ownership/health evidence still applies.

## 2. Only after A8 installation PASS: development

Use the owner-approved single-pass **code → deploy → verify** workflow against **A8**, with `main` as the source. Update `fast-flow` and checkout selection to be A8-local and independent of S22's hard-coded QA path/markers. Keep H2 static Hosting separate from Node. Prioritize real backend/UI integration, managed process/site ownership, M2–M5 Hosting (project install/update, status/logs, Cloudflare/domain access under approval, backup/restore), and Local Agent diagnostics. Minimize repeated audits and duplicate agent tasks. Do not run test suites until authorized.

## Exit and privacy constraints

- S22 remains a production IleStoi/Cloudflare/SSH/MQTT host; no S22 PocketHost services are registered. Do not reinstall, restart or transfer anything there.
- Pi Zero 2 W still runs production PhotoMap with its independent native backup. Do not conflate it with the retired S22 POC.
- Do not erase S22 preserved historical Git worktrees/site data; eight QA trees contain uncommitted changes, and one old commit was not confirmed on GitHub.
- Use the existing private GitHub Local Agent transport and one bounded immutable task per action; correct A8 installation IDs are in private evidence, not this public repo. No Mac, Codex, Work, Actions, unattended scheduler or implicit retries.
- The previously discussed S22 clean-Termux rebuild/recovery plan was **cancelled**; the owner removed its Android Downloads backups. No currently verified off-S22 IleStoi recovery exists.

**First milestone:** A8 PocketHost installed and healthy with exact live SHA, own runit services and host-only ownership markers. **Second milestone:** resume PocketHost feature development on that verified A8 baseline.
