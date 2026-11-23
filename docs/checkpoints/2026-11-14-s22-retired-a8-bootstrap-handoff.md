---
status: closed
owner: core
last_reviewed: 2026-11-14
purpose: S22 PocketHost retirement evidence and A8 launch boundary
---

# PocketHost — S22 retired; Galaxy A8 selected

## Verified S22 exit

The owner chose to keep Samsung S22 Termux and its independent services running, remove PocketHost's running panel, and start PocketHost fresh on a different Samsung Galaxy A8. No Termux reset or service migration is authorized.

Final **read-only S22 closure**: `pockethost-s22-final-closure-readonly-20261114-v1` returned `done / exit 0 / PASS`.

- No `pockethost-panel` or `pockethost-panel-watch` service registration remains. Their earlier runit retirement task returned PASS; **no PocketHost panel is running on S22**.
- `wreckscanner` (IleStoi), `cloudflared`, `sshd`, `mosquitto` and `ilestoi-healthwatch` were running; IleStoi loopback readiness returned HTTP **200**. Local Agent's private task/result transport remains usable. Do not adopt or restart these independent services.
- Test PhotoMap source, `photomap-test` managed instance, its local snapshot and registry were removed after ten local source changes had been archived to GitHub. The now-empty `PocketHost-Managed` wrapper was also removed. Production PhotoMap on Raspberry Pi Zero 2 W and its native plain backup were not changed.
- The old Android `Download/Termux-Recovery/Plain-20261114-v1` and `Project-Native-20261114-v1` folders are absent after the **owner manually deleted them and emptied the bin**. No new S22 backup was created. This leaves **no confirmed independent off-S22 current IleStoi backup**; owner accepts this risk. Other Termux-private backup remnants were not comprehensively erased or newly certified.
- Final observed S22 available space: **161.19 GiB** (snapshot in time, not a guaranteed current measurement).

## Deliberately retained and why

Fourteen `PocketHost*` directories remain under `~/Projects/`, including `PocketHost`, historical QA code and two site-container roots. Eight old QA worktrees have local tracked/untracked changes; do **not** erase them as clean clones or claim the edits were pushed. The `PocketHost-Quality-20261105` worktree's commit was not confirmed accessible on GitHub. `PocketHost-H3-QA-20261107` retains ignored historical `.tmp` diagnostic/screenshots. Two `PocketHost-UserSites` and one `PocketHost-OwnedSites/pockethost-demo` were preserved as potentially useful site data. Shared state `~/.local/state/pockethost` includes SSH-related evidence/configuration and was left untouched.

A detached `termux-api-broadcast` process with CWD inside the old `PocketHost-P3-MVP-ReleaseQA-20261106/apps/admin` was observed. The attempted combined source+service cleanup stopped safely before changes, so that checkout was retained. An independent subsequent operation removed **only** the two down runit service directories. Do not kill the process or delete its CWD while ownership is uncertain.

This is **operational retirement**, not a claim of a bit-for-bit removal of all old source, sites, or historical private configuration. Do not run more PocketHost tasks on S22 as part of the A8 plan.

## Saved PhotoMap proof of concept

The completed PhotoMap-on-Termux experiment and reusable `/health` probe, runit and svlogd launch patterns, SQLite/media diagnostics and USB ADB transfer notes are in [PhotoMap's toolkit](https://github.com/MichalMatu/photomap/blob/main/docs/termux-poc-toolkit.md). Ten local UI edits were preserved in [PhotoMap's S22 archive branch](https://github.com/MichalMatu/photomap/tree/archive/s22-termux-poc-20261114) before deletion of the S22 checkout.

## A8 preflight and next deployment gate

Galaxy A8's **read-only private task** `pockethost-a8-prebootstrap-readonly-handoff-20261114-v1` returned `done / exit 0 / PASS` from the paired Local Agent. It had **no PocketHost checkout**, Termux Git 2.56, Python 3.14, shell/curl/sv available, **Node and npm missing**, and approximately **16.99 GiB free**. Runit states of `sshd` and `ssh-agent` were inconclusive; there was no named local-agent runit service, but the successful A8 task receipt proves its actual Git task executor is reachable. Do not assume service startup infrastructure is ready without preflight.

The current launcher `ops/termux/install-panel-services.sh` requires an installed Vite dependency tree; `ops/termux/panel-owner.mjs` expects prior PocketHost owner files from the earlier S22 deployment; and `ops/termux/fast-flow.mjs` hard-codes an existing S22 QA worktree and live-owner markers. **They are not a one-command clean installer for bare A8.** First implement a guarded, device-local **cold start** that generates new _A8-only_ owner records and staged services, then verify exact source/PID/ticks and only activate the A8 panel. Do not copy any S22 markers, credentials, sites or service registrations.

For the ordered A8 launch and later product work, use [the next-chat handoff](../HANDOFF_NEXT_CHAT.md). No extra scheduler, GitHub Actions, Codex, Work or cross-device failover.

## Final reaudits — S22 legacy WreckScanner mapping (14 November)

Post-closure read-only receipt `s22-ilestoi-final-readonly-closeout-20261114-v2` = PASS; 127.0.0.1:8001 live/ready HTTP 200; `wreckscanner`, `ilestoi-healthwatch`, `cloudflared`, `sshd`, `mosquitto` running; `wreckscanner-backup` disabled; no PocketHost panel/watch service registration. The `WreckScanner` name remains an **active legacy runtime identifier**, not disposable trash: `~/WreckScanner/WreckScanner`, SQLite `wreckscanner.sqlite3` (393 field photo rows at read-only audit), env `WRECKSCANNER_*`, autostart, runit and historic Cloudflare domain aliases. No renaming, restarts or new backups were performed. Current S22 IleStoi SHA `b31b8f57684a1ff0e916de5f6e6146a78faaa831` is **16 commits ahead of** GitHub `ilestoi/main` SHA `ea1b300351d6519ba387d08cb22d6aea2b204d2c`; do not reconcile as part of A8 work. Docs were prepared on a separate draft [PR #40](https://github.com/MichalMatu/ilestoi/pull/40), not deployed. Updated A8 read-only preflight `pockethost-a8-handoff-final-readonly-20261114-v2` = PASS, but A8 Node/npm still missing; no PocketHost installation yet. See [final cross-device checkpoint](2026-11-14-final-s22-reaudit-a8-local-agent-handoff.md).
