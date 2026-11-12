---
status: source-complete-native-open
owner: core
last_reviewed: 2026-11-12
purpose: Nine-screen System source audit, targeted UI fixes and open Samsung visual evidence
---

# PocketHost — nine System screens, UX and source checkpoint

## Baseline and boundaries

- Source reviewed at `c6c5d6b5343da86f779e41aa837c4646c38bbe0b` (2026-11-12), following
  the verified Services change `3b1a0c3fec2c08ee429bf9ab9c2ccd5efdd5b8b8`.
- The existing Samsung Services task
  `pockethost-services-focused-check-3b1a0c3-20261112-v1`
  returned **PASS**: 8/8 focused interaction tests and admin TypeScript.
  This receipt does **not** validate the changes in this checkpoint.
- The previous screenshot attempt
  `pockethost-system9-screenshot-audit-20261112-v1` was killed by
  `command_memory_limit` (1300 MiB cap, 1344 MiB RSS); it was not
  a time-limit failure.
- The second screenshot attempt
  `pockethost-system9-capture-2560-20261112-v2` uses 2560 MiB per
  task. At checkpoint creation its terminal result is **PENDING**.
  No screenshot images have been reviewed or accepted.
- Samsung reported 2568 MiB currently available RAM in
  `pockethost-termux-memory-two-layer-check-2560-20261112-v1`.
  Its installed Local Agent still defaults to 4096 MiB; the
  Termux-specific 2560 MiB default exists in local-agent source only
  pending a separate guarded installation update.
- No real Android/Termux package, backup, filesystem or service
  mutation is authorized by this source audit. No panel restart
  or deployment is implied by the checkpoint.

## Nine-screen source inventory

| System route | Ownership | Source assessment / next work |
| --- | --- | --- |
| `/dashboard` | Android host and bridge snapshot | Check history-range loading and stale samples in browser |
| `/observability` | Read-only Termux process diagnostics | Verify mobile table overflow and source labels |
| `/shizuku` | Privileged Android actions | Review warnings around service actions with unknown state |
| `/phone-settings` | Authorized Android display controls | Clear saved drafts only after confirmed mutation |
| `/packages` | Termux package preview and inventory | Distinguish partial Node/Python samples from complete lists |
| `/files` | Termux file browser | Fix false empty state and acknowledged-upload refresh error |
| `/services` | Runit controls plus external observations | Source-only read-only panel guard and duplicate list folding |
| `/terminal` | Existing ttyd session | Verify iframe error/connection diagnostics; do not start a session |
| `/backups` | Workspace / Restic / system backups | Clarify local versus off-device recovery and scope overlap |

## Implemented targeted fixes (source changes in this checkpoint)

1. `apps/admin/src/app/phone-settings/page.tsx`: clear the brightness
   or timeout draft after the corresponding **confirmed** save, then
   reread settings. Unconfirmed writes keep the draft intact.
2. `apps/admin/src/app/termux/full-files.tsx`: show Loading rather
   than "No files" before a first successful listing; treat an actual
   empty loaded listing as empty.
3. Same file: when upload returns success but a subsequent directory
   refresh fails, report the upload as acknowledged and the inventory
   as unavailable instead of falsely claiming an upload failure.
4. Extend only the existing phone-settings and H3.4 interaction
   tests for those behaviors; no blanket suite.

## Open bugs and UX gaps (not falsely marked fixed)

- **P0 security/release:** trusted-LAN administrative terminal is
  explicitly no-login. Reconsider access controls before public or
  broader LAN exposure. Existing owner-operation boundaries apply.
- **P1 Services:** the `pockethost-panel` / `pockethost-panel-watch`
  guard is a **UI safeguard**, not proof the `/api/v1/termux-admin`
  service-control endpoint independently blocks those operations.
  Review backend protections before extending lifecycle controls.
- **P1 Android services:** runtime state is reported unknown while
  Start/Stop commands are available. Keep explicit scope and
  confirmations; do not infer an Android service is running.
- **P1 Terminal:** an alive ttyd status does not prove the embedded
  iframe has connected successfully; offer clearer iframe recovery.
- **P1 Backups:** multiple local backup mechanisms overlap in UX
  and are not equivalent to recoverable off-device copies.
- **P2 Monitoring:** clarify CPU lifetime ticks versus live %
  and allow readable process tables on narrow screens.
- **P2 Dashboard:** distinguish in-flight range changes and
  stale/partial history from fresh live readings.
- **P2 Packages:** make truncated metadata and cached update
  hints unmistakable.
- **P2 Screen capture:** obtain real 9-route desktop and mobile
  screenshots, compare actual UI and test only safe read-only
  interactions. The image files are not established by a task
  request alone; a terminal receipt and accessible artifacts
  are needed.

## Verification and handoff

- **Source commit:** the commit containing this checkpoint, phone
  settings/files fixes and focused tests (inspect fresh main HEAD).
- **New source verification:** OPEN until Samsung returns exact-SHA
  terminal receipts for
  `apps/admin/tests/phone-settings.interaction.test.tsx`,
  `apps/admin/tests/h34-termux.interaction.test.tsx`, and the
  incremental admin TypeScript check.
- **Visual screenshots:** OPEN pending the existing capture task.
  Do not queue an equivalent task while its receipt is pending.
- **Live DEV panel HMR/refresh:** OPEN; no source commit proves
  the running phone UI was updated.
- **G2/G3 release:** not rerun; prior exact-SHA evidence retains its
  historical scope. Physical destructive/recovery and release gates
  remain separate.

Next: receive the existing screenshot task result once, inspect accessible
images if any, run only the two affected interaction files and incremental
TypeScript on the exact source SHA, then perform owner visual review.
Preserve all unrelated phone services. Never infer hardware PASS
from source status or re-run full check:all to clear a small UI change.
