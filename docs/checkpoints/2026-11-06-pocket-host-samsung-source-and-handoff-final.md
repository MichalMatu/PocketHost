---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-06
purpose: Exact Samsung PocketHost source and documentation QA receipts plus next-chat continuation
---

# PocketHost — Samsung source and handoff checkpoint (2026-11-06)

## Current refs and exact accepted receipts

- Repository: `MichalMatu/PocketHost`, **existing** branch `sprint/p3-mvp-integration-20261105`.
- Last verified branch HEAD before this docs-only checkpoint: `3ee728fa6c7d0272b8aa7b1fdfc332a62bf6138d`.
- Last observed `main`: `8378663725f10beacf9c527f194e7f568170284d` (not merged).
- Last **source-code-tested** commit: `a5443070f1c6e41798641aa9c2098a9acc9e17a4`.
- Source QA task: `pockethost-photomap-python-contract-final-samsung-20261106-v2`,
  on `MichalMatu/local-agent:agent-control`: **done / exit 0**.
  `node --test tests/quality/photomap-runtime-host.test.mjs` 9/9 PASS;
  root `npm run check` 65/65 Node tests, 66 Markdown documents/0 errors,
  Prettier, ESLint, TypeScript PASS; device port 8010 remained closed.
- Documentation QA task `pockethost-python-contract-docs-checkpoint-native-20261106-v2`
  at exact docs SHA `3ee728fa...`: **done / exit 0** — `check:docs`, `markdownlint`,
  Prettier on changed docs and `git diff --check` PASS. This task did **not** repeat source tests.
- Historical failed QA tasks: first source QA `...guarded-python-contract-native-20261106-v1`
  passed the tests but caught ESLint `no-regex-spaces`; source/test-only fix in `a5443070`
  has a passing terminal receipt. The first checkpoint docs QA caught a single Prettier
  emphasis change (`*not*` to `_not_`); corrected in `3ee728fa` and accepted by v2.

## Physical staging and unchanged owner boundaries

- Physical host: Samsung Termux Local Agent, host `android-termux-10520`,
  installation `6be16f1d-194b-4f07-b377-3d4bb218fcd7`. Treat the control branch
  HEAD as moving; verify task-results, exact identity and service before issuing a new task.
- Read-only P4 PhotoMap catalog and HTTP negative gates were accepted.
  P3 static demo, LAN gateway, six foreign monitored services and original PhotoMap
  remained unchanged across the earlier live cutover.
- Imported original PhotoMap TEST source, SQLite (19,574,784 bytes), media
  (2,196 files / 4,258,135,454 bytes) and independent backup are preserved;
  original PhotoMap runit/autostart remains disabled.
- Two **already staged, stopped** Debian runtime copies: `debian-arm64-v1` and
  `debian12-photomap-20261106-v1`. The second has independent work/source
  (2,746 files), working SQLite with integrity OK and Debian Python 3.11.2
  with the eight required packages. Do **not** recopy either runtime or imported media.
- The host adapter uses the verified guest Python
  `/opt/photomap-venv/bin/python` and rejects forged partial enablement.
  The selected version is still `staged-unapproved`, `isolated_rootfs=false`,
  without a runtime active-version pointer. Imported runtime flags remain
  `enabled=false`, `launch_allowed=false`, `managed_proot_snapshot=false`,
  `autostart=false`. Port 8010 OFF in latest accepted source QA.
- **No live managed PhotoMap lifecycle acceptance**: real Start, HTTP health,
  PID/start-ticks/cwd/executable/argv/PRoot child identity, safe Stop, orphan
  prevention, SQLite migration/recovery and whole-instance rollback are unverified.
  PRoot is not an OS security sandbox. Do not approve the staged profile just
  to satisfy a test; never point migrations at the imported original SQLite.

## Gates and priorities for a new conversation

1. Read root/nearest `AGENTS.md`, `docs/LOCAL_AGENT_TERMUX.md`,
   `docs/HANDOFF_NEXT_CHAT.md`, `docs/ARCHITECTURE.md`,
   `docs/QUALITY_GATES.md`, ADR-0007/0008/0009 and this checkpoint.
   Freshly verify feature/main HEAD, Samsung installation ID and task-result ledger.
2. Read-only phone preflight: six monitored services, P3 ownership, port 8010,
   both stopped versions, owner manifest flags, exact independent work SQLite,
   free space, PRoot sessions and clean exact-code QA checkout.
3. Next source stage (not yet accepted): add/qualify precise forged-owner,
   PID reuse/start ticks, cwd/executable/argv, child/PRoot ownership, port
   collision, launch timeout, idempotent Stop and orphan/error negative tests.
   Execute **only on Samsung**; preserve accepted tests and artifacts.
4. A **separately explicitly authorized** bounded manual PhotoMap Start/health/Stop
   may use the independent copied source/SQLite only after identity/safe-stop
   preflight; otherwise maintain HOLD. Do not add UI write APIs or autostart.
5. Separately accept real P3 browser publish/rollback button clicks from Mac,
   accessibility follow-up, fresh external-service snapshot, release/merge decision.
   P5 AI app-management and public hosting are deferred.

## Non-negotiable execution and final status

Use GitHub Connector + **Samsung Termux Local Agent** for PocketHost code/test/host
operations. No Codex, ChatGPT Work, GitHub Actions or status checks, Mac/sandbox
PocketHost tests, new branch, force push, broad package install, foreign process
stop, original import mutation, unapproved main merge or public exposure.
**Source QA PASS; docs QA PASS; PhotoMap lifecycle/release HOLD; P3 browser
mutation acceptance HOLD.** This docs-only checkpoint is not a new source build.

[Canonical handoff](../HANDOFF_NEXT_CHAT.md) ·
[Development plan](../DEVELOPMENT_PLAN.md) ·
[QA](../QUALITY_GATES.md) ·
[Staged Python checkpoint](2026-11-06-photomap-isolated-rootfs-python-qa-closeout.md).
