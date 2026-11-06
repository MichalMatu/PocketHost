---
status: in-progress
owner: core
last_reviewed: 2026-11-06
purpose: Consolidated P4 PhotoMap managed catalog acceptance and next-chat handoff
---

# P4 — PhotoMap TEST managed catalog closeout

## Scope and result

P4 introduces **one real, imported, non-running project**: `photomap-test`. This is the foundation for a generic managed-project architecture, **not** a ready-made way to run arbitrary apps.

- Typed `ManagedProjectPort` snapshot with explicit ownership and capability flags.
- Host-only `ManagedPhotoMapHost` validates the canonical registry, manifest schemas/owners/versions, stopped state, source release and copied data inventory. It rejects symlink escapes, forged owner, unsafe release paths, enabled autostart or unapproved package operations.
- Localhost DEV API: **GET-only** `/api/v1/managed-photomap`, with fixed Host/Origin/method checks and no accepted arbitrary ID or command.
- GUI route `/managed-projects`: release, database/media counts, six allowlisted tool versions and private project dependency lock-file hashes. No secrets or absolute managed paths returned.
- All 32 original dashboard template routes, P1 read-only host status and P3 owned demo site remain available.
- PhotoMap runtime, package updates and full rollback remain explicitly **disabled** until independently safe PRoot and whole-instance snapshots are proven.

The actual **stopped PhotoMap managed import is already accepted**: `pockethost-photomap-managed-import-copy-20261106-v2` done/exit 0, 2,746 release files, 3,011 backed-up code files, verified SQLite and 2,196 media files, 4.26 GB copied. See [import closeout](2026-11-06-photomap-runit-autorestart-regression.md).

## Native Samsung acceptance evidence

All commands ran **exclusively on the physical Samsung Termux** through the verified Local Agent; no Codex/Work, Actions, Mac build or Linux sandbox. The P4 checkout is isolated from live PocketHost and other services.

| Task | Terminal result | Interpretation |
| --- | --- | --- |
| `pockethost-p4-photomap-preflight-20261106-v1` | failed, invalid task | Timeout budget rejected before any device commands |
| `pockethost-p4-photomap-preflight-20261106-v2` | done, exit 0 | Confirmed imported registry, runtime OFF, no runit link, port 8010 free, Node 26.4.0, npm 11.19.0, git 2.55.0 and Python 3.14.6 |
| `pockethost-p4-photomap-managed-catalog-native-quality-20261106-v1` | failed, exit 1 | Branch moved during clone; SHA guard stopped before dependencies/tests |
| `pockethost-p4-photomap-managed-catalog-native-quality-20261106-v2` | failed, exit 1 | Pinned dependencies installed; docs gate failed for missing checkpoint index entry, subsequently fixed |
| `pockethost-p4-photomap-managed-catalog-native-quality-20261106-v3` | failed, exit 1 | The pre-fix SHA still contained the missing docs index entry; not a current-source validation |
| `pockethost-p4-photomap-rapid-native-diagnostics-20261106-v1` | failed, exit 1 | On `49d0cc8` **50/50 foundation tests PASS**, Markdownlint 61 files / zero errors, Prettier identified **3 files** requiring formatting |

The historical failures are retained here as concise audit evidence; **none prove that the PhotoMap data import failed**. Formatting and final same-SHA quality/build gates are being closed separately. Do not claim full native quality or a new live GUI deployment until the corresponding terminal task receipts exist.

## Safety and known limitations

The imported source was created from original Git HEAD `d49e94c9` **plus local uncommitted modifications** and must never be replaced by a clean repository HEAD. The managed root is `~/Projects/PocketHost-Managed`; the original PhotoMap checkout and its backups are intact. Old PhotoMap run script still changes into `~/Projects/PhotoMap`, so merely executing it would start the wrong code. Python dependencies exist in an **external-unfrozen Debian PRoot**; they cannot be reliably rolled back with code alone.

No PhotoMap process, runit autostart, global package update, public listener, external service mutation, or Raspberry Pi operation was authorized in P4. Previous import evidence showed six external services unchanged; a separate exact-path service snapshot is needed if any future panel cutover is proposed.

## Release contract and next step

P4 is accepted **only** after complete same-SHA root `npm run check`, admin lint/build and UI tests plus a guarded localhost-only HTTP negative test for the new catalog. Until then status is **SOURCE CANDIDATE / NOT DEPLOYED**; `main` remains at its older foundation SHA and the current LAN panel has not been updated by P4.

After validation, hand off to the next chat via [PocketHost next-chat handoff](../HANDOFF_NEXT_CHAT.md). The next major implementation is an isolated, versioned runtime for PhotoMap with exact managed paths, verified owned PID/start-ticks and tested stop/cleanup. Package plans and whole-instance rollback must remain disabled until Python environment, database migrations and media have restorable snapshots.
