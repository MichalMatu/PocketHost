---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-06
purpose: Single concise current-state handoff for safe PocketHost continuation
---

# PocketHost — current handoff

## Start from fresh source and host state

Repository `MichalMatu/PocketHost`; develop **only on fresh `main`**, unless the owner explicitly directs otherwise. The former sprint's 188 commits were fast-forwarded to `main` on 2026-11-07 (source `eefd870`). Historical working branches are already its ancestors and are awaiting safe deletion. The consolidation is **not** a production release or a new native QA receipt.

The last **source-accepted** SHA is
`a5443070f1c6e41798641aa9c2098a9acc9e17a4`.
Samsung task `pockethost-photomap-python-contract-final-samsung-20261106-v2`
returned done/0: 9/9 targeted negatives, 65/65 root Node tests,
66 Markdown docs, lint/types/format PASS, PhotoMap port 8010 OFF.
The last separate docs-only gate at `3ee728fa` returned done/0.
Later changes need targeted new same-SHA qualification, not a replay of old results.
See the [exact acceptance](checkpoints/2026-11-06-pocket-host-samsung-source-and-handoff-final.md).

## What already works — preserve it

- **P0–P2:** root gates, six allowlisted external-service observations,
  Android Termux host panel and the React/Vite admin template.
- **P3:** a manually owned static demonstration site with guarded lifecycle,
  publishing, one-step rollback and optional trusted-LAN gateway. Device and
  browser *viewing* passed; actual Mac browser Publish/Rollback clicks did not.
- **P4:** read-only PhotoMap TEST managed catalog and GET API, with POST denied.
  An independent imported source, original/backup SQLite and 2,196 media files
  are preserved; do not recopy or mutate them.
- Two stopped Debian 12 rootfs versions already exist. The selected
  `debian12-photomap-20261106-v1` has independent working source/SQLite,
  Python 3.11.2 and eight dependencies. The profile remains
  `staged-unapproved`; launch, autostart and activation are disabled.

Never confuse the accepted negative tests and staged Python interpreter with
a verified active managed PhotoMap instance. Details:
[staged runtime evidence](checkpoints/2026-11-06-photomap-isolated-rootfs-python-qa-closeout.md).

## Release HOLD

- P3 button-click/keyboard/a11y acceptance, final owned-state/security readback.
- PhotoMap precise PID/start ticks, executable/cwd/argv and PRoot-child identity;
  port collision, failed launch/orphans, idempotent safe Stop, logs, SQLite
  migration/recovery and full restore remain unproven on real hardware.
- No approval for live PhotoMap Start, UI mutation, package changes, public ingress,
  autostart, changing production services or a production release.

## Safe next action

1. Read [agent rules](../AGENTS.md), [Local Agent runbook](LOCAL_AGENT_TERMUX.md),
   [architecture](ARCHITECTURE.md), [quality gates](QUALITY_GATES.md) and relevant
   [ADR-0007](adr/0007-photomap-managed-instance-layout.md),
   [ADR-0008](adr/0008-photomap-p4-managed-catalog.md),
   [ADR-0009](adr/0009-photomap-isolated-runtime.md).
2. Confirm the fresh private Samsung Termux Local Agent host/installation,
   intake, terminal ledger, independent QA checkout cleanliness and current refs.
   The previous accepted target was `android-termux-10520` with installation
   `6be16f1d-194b-4f07-b377-3d4bb218fcd7`; an old receipt is not liveness.
3. Use **read-only preflight** for six foreign services, P3 ownership, port 8010,
   rootfs/work SQLite, PRoot sessions and storage. Never affect original PhotoMap.
4. Add only bounded negative source/fixture tests for process identity, orphans
   and port conflicts. After code changes, qualify on Samsung with
   `npm run check:all`, saving the exact terminal result.
5. Obtain separate explicit authorization before any real manual
   PhotoMap Start/health/Stop on disposable copied data. Keep all public and
   write-control surfaces closed until independent acceptance.

**Execution:** GitHub Connector + exact Samsung Termux Local Agent only.
No Codex, ChatGPT Work, GitHub Actions or status checks, Mac/sandbox PocketHost
execution, new branches or force push. Never restart or take ownership of
IleStoi.pl, original PhotoMap, Local Agent or other external services.

## Documentation maintenance

Use [the documentation entrypoint](README.md) for current work.
Historical checkpoints are indexed separately in
[the archive](checkpoints/README.md). Avoid a new checkpoint for every QA attempt:
update this handoff and the affected owner/module docs; preserve detailed immutable
evidence only at real acceptance boundaries. Do not reread or rerun the entire history.
