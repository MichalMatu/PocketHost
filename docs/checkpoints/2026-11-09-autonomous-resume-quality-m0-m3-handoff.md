---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Final autonomous resume receipt, exact-source quality evidence, M0-M2 source candidates, M3 work still open
---

# PocketHost — autonomous resume and next-chat handoff

## Baseline and hardware

- The starting `main` was `4a52abef3d33bd1c9664fe2a0484ea18de738109`.
- On the Samsung S22, Mac SSH read-only preflight
  `pockethost-resume-mac-ssh-s22-readonly-20261109-gpt6-v1`
  returned eight `run` states: PocketHost panel and watchdog plus
  `sshd`, `wreckscanner`, `mosquitto`, `cloudflared`,
  `ilestoi-healthwatch` and `termux-agent`.
  Loopback `127.0.0.1:8787/shizuku` and private
  LAN `192.168.0.100:18878/shizuku` returned HTTP 200.
  Mac direct HTTP task
  `pockethost-resume-mac-http-readonly-20261109-gpt6-v3`
  also returned 200.
- The clean live checkout was `2d9cab21f14ff14f14704bc0d1d1b26eb7d98528`.
  QA used a separate detached checkout. There was **no runtime cutover**,
  panel restart, public route change or protected service mutation in
  this sprint. Prior accepted one-service recovery retained rollback;
  whole-phone reboot and watchdog hang/flap tests remain OPEN.

## Quality receipts

- `pockethost-handoff-postfix-native-gates-20261109-v1` was
  **done/0 PASS** for `f7eb90e9c50996e0f029acf7475793f81fabdb31`:
  structure, docs, boundaries, **182/182 Node tests**, ESLint,
  typecheck, admin lint/build and 3/3 panel-contract tests.
  Do not rerun this historical matrix.
- `pockethost-quality-format-native-prep-1028946-20261109-gpt6-v1`
  produced a reviewed 34-file Prettier-only patch on S22:
  Prettier check PASS, Markdownlint **0 errors in 105 files**,
  docs PASS, `git diff --check` PASS. The full patch was
  exported in 12 intact chunks by
  `pockethost-native-format-patch-export-1028946-20261109-gpt6-v1`
  and committed through GitHub Connector as `2861c43f6d184830d6b39231f3f44b166989514d`.
- First all-in-one task failed **before tests** because `origin/main`
  did not exist in the QA checkout; second failed **before tests**
  because formatted worktree content matched `2861c43` but its
  checkout HEAD was still the old commit, so Git refused switching.
  These are QA preflight errors, not source test regressions.
- `pockethost-final-checkall-safe-reset-2861c43-20261109-v1`
  is the corrected exact-SHA task. It checks fetched main, verifies
  tracked worktree content is identical to the target, rejects
  untracked files, then resets **only that isolated QA checkout**
  and runs `npm run check:all`. Read its terminal result before
  claiming G2. If no result exists, the gate is OPEN.

## Development sequence

- **M0/R0:** Full read-only code inventory and upstream reuse
  choices exist in
  [M0 source audit](2026-11-09-m0-source-and-upstream-audit-readonly.md).
  The next source slice moves the read-only `/host` menu entry from
  Hosting to System while retaining the route and preserving static
  H2 endpoints. It does **not** finish named legacy API decoupling.
- **M1 candidate:** A strict pure typed
  `createHostingRegistries` draft and tests introduce
  `ModuleDescriptor`, `HostedProject.components[]`,
  planned service records and opaque `SecretRef`. Validation
  rejects duplicate IDs, service adoption, stale module versions,
  secret plaintext and port collisions. No persistence or live
  service owner attestation exists yet.
- **M2 candidate:** Pure `planNodeDependencies` and negative tests
  preview an npm-only lockfile-checked `npm ci`, build and start
  argument array. It never installs packages or executes commands.
  Runit lifecycle, health policy and per-project backup/restore
  adapters remain OPEN.
- **M3 OPEN:** Browser-created Node.js app with scoped source import,
  app-local `npm ci`, owned launch/readiness, staged releases,
  logs, failure injection, rollback and recovery has **not**
  been implemented/accepted. Do not call the M1/M2 draft a Node
  Hosting MVP or enable hosted autostart prematurely.

## Next chat exact steps

1. Fetch the actual `main` and inspect this checkpoint, `AGENTS.md`,
   `docs/HANDOFF_NEXT_CHAT.md` and the M0 source audit.
2. Read terminal result of
   `pockethost-final-checkall-safe-reset-2861c43-20261109-v1`.
   Preserve completed results; do not restart already passed tests.
3. Validate any newer source only on S22 Local Agent, with narrow
   gates matching changed modules. Do not touch the live checkout.
4. Finish M0 compatibility/API decoupling and native H2 regression,
   then M1 persistent ownership registries, M2 shared native
   runit/health/backup adapter and one disposable M3 Node app.
5. Before any live M3 cutover, compare all six foreign services,
   panel/watchdog, H2 site data and rollback; use only explicitly
   owned disposable ports and retain independent recovery.
6. Reboot and watchdog hang/flap acceptance are separate G3 gates.

**Scope distinction:** a GitHub source commit is not a Samsung
installation; a test task being queued is not a PASS. Preserve
all confirmed receipts without inferring later exact-source status.
