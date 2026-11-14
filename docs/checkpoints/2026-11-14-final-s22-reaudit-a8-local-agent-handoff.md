---
status: closed
owner: core
last_reviewed: 2026-11-14
purpose: Immutable facts for S22 closeout and A8 Local Agent PocketHost bootstrap
---

# FINAL CHECKPOINT — S22 closed, PocketHost moves to Galaxy A8

## 1. Verified facts, not assumptions

**S22 (read-only result `s22-ilestoi-final-readonly-closeout-20261114-v2`, PASS):**
- IleStoi services `wreckscanner`, `ilestoi-healthwatch`, `cloudflared`, `sshd`, `mosquitto` RUN; liveness/readiness HTTP 200 on 127.0.0.1:8001; `wreckscanner.sqlite3` 667,648 bytes, 393 `field_photos`. Free space measured 161.19 GiB.
- `pockethost-panel` and `pockethost-panel-watch` not registered. PhotoMap POC and PocketHost-managed test instance have been removed; production PhotoMap **and its native backup** remain on Raspberry Pi.
- Historical `WreckScanner` naming is **actively used by IleStoi**: S22 code path, runit, SQLite, `WRECKSCANNER_*`, Boot hook and `wreckscanner.pl` alias in Cloudflare ingress. It is not safe to delete or rename for cosmetic reasons. [Read-only S22 legacy audit](https://github.com/MichalMatu/ilestoi/blob/fix/s22-legacy-runtime-docs-20261114/docs/checkpoints/2026-11-14-s22-wreckscanner-final-audit.md).
- `wreckscanner-backup` is DOWN; local Restic repo/password absent. Owner deleted the Android Downloads recovery archives and emptied bin. `~/IleStoi-Backups` still has historical SQLite-only copies, but **no verified current full off-device backup of IleStoi** exists. Do not create backups/schedulers or reenable old Restic as a side effect.
- Live S22 source SHA **`b31b8f57684a1ff0e916de5f6e6146a78faaa831`**, GitHub `ilestoi/main` **`ea1b300351d6519ba387d08cb22d6aea2b204d2c`**: production checkout is **16 commits ahead of GitHub main**, confirmed by ancestry comparison. No automatic Git reconciliation, force push, deployment or restart; draft docs-only [PR #40](https://github.com/MichalMatu/ilestoi/pull/40) explicitly remains unmerged.
- Historical PocketHost QA checkouts, uncommitted code, user/owned sites and old SSH evidence are deliberately preserved; operational service retirement is complete, **disk-level source erasure is not claimed**. No further S22 operations authorized for A8 task.

**Galaxy A8 (read-only result `pockethost-a8-handoff-final-readonly-20261114-v2`, PASS):**
- Existing A8 Local Agent can execute private immutable tasks and return results. Git 2.56.0, Python 3.14.10, bash, curl, sv installed. **Node/npm missing**; `~/Projects` currently empty; **16.99 GiB free** of 24.4 GiB; no selected PocketHost DEV listener. `sshd`/`ssh-agent` runit states **unknown**, not qualified.
- **PocketHost has NOT been installed on A8.** No production or developer panel was started. Do not imply otherwise.

## 2. Exact next-chat / Local Agent entry

**Mode: GitHub Connector + already paired Galaxy A8 Termux Local Agent only.** Select the private A8 host/install identity from the existing successful A8 task/result, not a hardcoded S22 identity. One bounded immutable task at a time, wait for a terminal receipt; a queued task is not success. Do not use Codex, Work, Actions, Mac or extra scheduler.

Sequence:
1. Re-read `AGENTS.md`, `docs/START_HERE.md` and [next-chat handoff](../HANDOFF_NEXT_CHAT.md); confirm current `PocketHost/main` exact SHA and the private A8 Local Agent receipt. Short fresh A8 preflight only if something changed.
2. Install supported Node.js >=22 and npm **on A8 only**; preserve room for dependencies, logs and panel. Clone fresh `PocketHost/main` in a new A8 directory. Do **not** move any S22 QA checkout, owner markers, credentials, sites or process ownership.
3. Implement/qualify **first cold install** separately from S22's guarded *update* path: current `fast-flow.mjs` assumes a live S22 QA owner and must never be run against empty A8. Before creating runit services, confirm supervisor, ports, source, user/session, owner markers and any existing process; fail closed for ambiguous ownership.
4. Stage disabled A8-owned runit services; only then activate A8's isolated **LAN/loopback** DEV panel. No public tunnel, production takeover or unrelated services. Verify actual live SHA, PID/start ticks, service owner root, health/status, logs and no impact on independent A8 services.
5. Return one **terminal PASS** with deployed SHA and reachable private URL/port, or **HOLD** with exact blocker. Do not run test suites/smoke suites unless explicitly requested; mandatory deployment ownership/health verification still applies.

**Only after A8 install PASS:** continue M2–M5 PocketHost development with source `main`, single-pass **code → deploy → verify** on the A8 Local Agent, targeted actual product features and minimal repeated audits. First fix old S22 hard-coded paths in FAST FLOW before enabling it on A8. Keep H2 static Hosting independent of Node, and preserve other services as external unless positively PocketHost-owned.

## 3. Exit status / stop on S22

**S22 final scope closed; no further PocketHost operations on S22.** A8 installation is the next action, not completed in this checkpoint. [Earlier retirement checkpoint](2026-11-14-s22-retired-a8-bootstrap-handoff.md) · [Handoff for new chat](../HANDOFF_NEXT_CHAT.md).
