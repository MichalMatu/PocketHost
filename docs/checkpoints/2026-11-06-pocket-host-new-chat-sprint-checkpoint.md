---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-06
purpose: Preserve exact PocketHost Samsung QA, protected runtime state and next-chat execution contract
---

# PocketHost — clean next-chat sprint checkpoint (2026-11-06)

## Exact refs and accepted evidence

- Repository: `MichalMatu/PocketHost`; continue on the **existing**
  `sprint/p3-mvp-integration-20261105` branch. At checkpoint entry,
  feature HEAD was `1d996d93dc6171fbffc8082153444a599f44328e` and `main` was
  `8378663725f10beacf9c527f194e7f568170284d` (not merged).
- The last **source-tested code** remains
  `a5443070f1c6e41798641aa9c2098a9acc9e17a4`.
  The four subsequent commits through entry HEAD are documentation-only.
  Do not claim an independent device source QA for later docs commits.
- Exact Samsung task
  `pockethost-photomap-python-contract-final-samsung-20261106-v2`
  returned **done / exit 0**: nine targeted host-negative tests, all
  **65/65** Node tests, 66 Markdown files with zero errors, Prettier,
  ESLint and TypeScript PASS; PhotoMap port 8010 closed.
- Documentation-only task
  `pockethost-python-contract-docs-checkpoint-native-20261106-v2`
  returned **done / exit 0** at documentation SHA `3ee728fa`
  for structure, Markdownlint, Prettier and diff-check. Newer docs changes
  require only documentation gates, **not** a replay of 65 source tests.
- See [exact Samsung checkpoint](2026-11-06-pocket-host-samsung-source-and-handoff-final.md)
  and [canonical handoff](../HANDOFF_NEXT_CHAT.md) for receipts and scope.

## What must remain unchanged

- Samsung Termux Local Agent: host `android-termux-10520`,
  installation `6be16f1d-194b-4f07-b377-3d4bb218fcd7`.
  Verify this binding and live service anew before any new task.
- P3 static demo and accepted trusted private-LAN gateway are separate
  from PhotoMap. P3 Mac browser **actual publish/rollback clicks** remain
  an unaccepted GUI gate; no merge to `main`.
- P4 PhotoMap inventory is **GET-only**, with Start/Stop and package actions
  disabled. The original imported TEST SQLite, source and media, plus
  backup, remain untouched; do not recopy.
- Two stopped versioned Debian copies already exist
  (`debian-arm64-v1`, `debian12-photomap-20261106-v1`).
  The selected second copy has independent source, work SQLite (integrity
  OK), Python 3.11.2 and eight required packages. It is still
  `staged-unapproved`; runtime enablement, autostart and activation are OFF.
- The source now uses verified guest interpreter
  `/opt/photomap-venv/bin/python` and fail-closed activation-profile checks.
  A source negative-test PASS is **not** real PRoot process ownership,
  HTTP health, Stop/orphan verification, safe SQLite migration or restore.

## Next bounded sprint in a separate conversation

1. Read root and descendant `AGENTS.md`, `docs/LOCAL_AGENT_TERMUX.md`,
   `docs/HANDOFF_NEXT_CHAT.md`, `docs/ARCHITECTURE.md`,
   `docs/DEVELOPMENT_PLAN.md`, `docs/QUALITY_GATES.md`,
   ADR-0007/0008/0009 and this checkpoint. Refresh feature/main heads.
2. Run **read-only** Samsung preflight via the exact Termux Local Agent:
   clean isolated code checkout, six foreign services, P3 process/ports,
   closed 8010, no PhotoMap autostart, both existing stopped rootfs copies,
   exact work SQLite, PRoot sessions and storage. Do not mutate originals.
3. Choose one previously staged isolated copy and extend/test **negative**
   process-identity safeguards: owner, PID/start ticks, cwd/exe/argv,
   PRoot descendants, port collision, timeouts, idempotent Stop and orphans.
   Source changes must pass new same-SHA native Samsung gates; do not
   rerun unchanged accepted 65/65 just to make a checkpoint.
4. Any real manual Start/health/Stop needs **separate explicit approval**,
   disposable copied source/SQLite, identity-proven graceful Stop and
   independent final port/service checks. Never enable general UI writes,
   package installs, original-DB migrations, boot hooks or public ingress.
5. Independently obtain real P3 Mac browser Publish/Rollback button
   acceptance and a fresh protected-service snapshot before a merge
   or release decision.

**Status:** PocketHost source QA PASS; last verified docs QA PASS;
PhotoMap live lifecycle HOLD; P3 GUI mutation acceptance HOLD;
release and `main` merge HOLD. Do not conflate with EventMap's separate
Debian Local Agent Git-transport incident.
