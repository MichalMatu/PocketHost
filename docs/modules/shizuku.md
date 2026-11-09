---
status: accepted-with-follow-up
owner: shizuku
last_reviewed: 2026-11-09
purpose: Current Android Companion/Shizuku boundaries, capabilities and acceptance
---

# Shizuku Module

## Architecture

The owner-facing Android & Shizuku UI calls fixed typed APIs
in PocketHost's existing Termux DEV panel. Termux forwards
requests to the Android-loopback PocketHost Companion;
the Companion uses its own authorized Shizuku Binder
service under the **actual** ADB/root UID and Android
permission rules. Browser JavaScript cannot obtain
Binder privileges itself.

Key locations: apps/admin/src/app/shizuku/,
apps/admin/tests/shizuku-*.interaction.test.tsx,
src/shared/shizuku.ts, src/modules/host/shizuku-companion.mjs,
and native/pockethost-companion/. Read relevant files
individually, not a whole native/test tree.

## Owner-directed capabilities

- Session status, Shizuku authorization/mode, negotiated
  capabilities and real UID/errors.
- Android app inventory, labels, enabled state, app details
  and permission flags; paginated/filterable user/system apps.
- Process, CPU, RAM, battery/charging, service and device
  setting observations; inaccessible metrics report unknown,
  not zero. Large memory values use binary GiB.
- Native owner operations, where actual Android permission
  allows: app launch/stop/enable/disable/uninstall-for-user,
  permission grant/revoke, PID TERM, service start/stop,
  brightness/timeout and Advanced Shell.
- Browser Advanced Shell Run directly forwards one explicit
  command to Android loopback and returns actual stdout,
  stderr, exit status or OS error, with bounded execution.
  The old phone-pairing/approval queue was superseded by
  the owner's 2026-11-09 direct-Run decision.

**Do not reintroduce artificial pair codes, per-command
native approval, command-category bans or simulated
read-only results in the owner-private DEV panel.**
Shizuku ADB is not root. Never auto-execute commands,
fabricate permissions, claim remote administration is
secure, open WAN access or modify unrelated services
from test automation. See root AGENTS.md and
[Shizuku owner decision](../adr/0013-shizuku-power-user.md).

## Device evidence versus source

Historical Samsung hardware acceptance of direct
browser Advanced Shell at 186185680d74ffc1d44eaedeb6ee4702a1f6174e
includes an actual Android shell UID via Shizuku ADB.
It validates **that older revision and route only**,
not all later package/service/permission controls.

Later Android & Shizuku MVP source adds richer UI,
application actions, permission selection, process
samples, shell diagnostics and settings actions.
Do not infer that this exact new APK is installed,
all operations work or the latest GitHub main is
running. A controlled native Android build/install,
focused UI/backend tests, operation/denial matrix,
and actual phone/browser acceptance remain separate.

Historical implementation details and exact receipts:
[direct shell](../checkpoints/2026-11-09-shizuku-direct-browser-shell.md),
[Android MVP](../checkpoints/2026-11-09-shizuku-mvp-sprint.md),
[seven-module sprint](../checkpoints/2026-11-08-shizuku-seven-module-sprint.md),
[companion shell history](../checkpoints/2026-11-08-shizuku-browser-remote-shell.md).
