---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Password-free Termux recovery checkpoint and safe clean bootstrap
---

# Termux clean rebuild — plaintext recovery

## Owner's explicit direction (2026-11-14)

**Zero backup passwords and zero backup encryption.** Do not use or initialize
Restic in this workflow. Preserve original services and files until recovery
is proven and the owner separately approves stopping or reinstalling Termux.
Store the recovery in Android Downloads and then on independent off-device
media. Do not claim that plaintext archives are private: a full Termux
archive contains **unencrypted SSH/Cloudflare credentials, private media and
service configuration**. Keep it on trusted/offline storage and prevent
unnecessary sharing.

## Read-only inventory and PhotoMap database determination

- Samsung host/installation: `android-termux-10520` /
  `6be16f1d-194b-4f07-b377-3d4bb218fcd7`.
- IleStoi: active runit cwd `~/WreckScanner/WreckScanner`;
  SQLite `wreckscanner.sqlite3` 663,552 bytes. Photos: 778 public
  (~1.03 GB) plus 390 private (~1.63 GB).
- PhotoMap: 4 files `app.db`, each 19,574,784 bytes. Physical file SHA
  splits into two identical pairs (dev/managed and two runtime versions).
  Task `termux-rebuild-photomap-logical-comparison-20261114-v1`
  confirmed **all tables have identical logical row content** across
  those pairs, including 1082 photo and 195 place rows. Identical content
  does not mean runtime file paths are redundant and safe to delete.
  No running PhotoMap process or canonical production DB was positively
  established in the process scan. Newest *file mtime*:
  `~/Projects/PocketHost-Managed/instances/photomap-test/runtime/versions/debian12-photomap-20261106-v1/work/database/app.db`,
  2026-11-06 09:57:37 UTC. It is the selected snapshot source, **not**
  an attested live production database. PhotoMap managed media inventory:
  2,093 images, ~3.88 GB.
- Installed Termux package inventory: 461 packages. Service data includes
  runit/Boot, independent Local Agent, PocketHost, SSH, Cloudflare,
  Mosquitto, IleStoi and PhotoMap.
- Storage preflight: `home` 28,897,305 KiB, `usr` 4,983,619 KiB;
  Android Downloads had 121,394 MiB available at the check.

## Completed plaintext database backup

Samsung task `termux-rebuild-plain-db-backup-cleanup-20261114-v1`
returned done / exit 0 / PASS.

`~/storage/downloads/Termux-Recovery/Plain-20261114-v1/`

- `photomap.sqlite3` — **one** SQLite online snapshot from the latest
  runtime file. `PRAGMA quick_check = ok`, 11 tables, 19,574,784 bytes.
- `ilestoi.sqlite3` — **one** SQLite online snapshot, quick_check ok,
  4 tables, 663,552 bytes.
- `installed-packages.tsv`, `manifest.json` with source paths,
  checksums, table counts and explicit lack of media/full-rescue archive.

All 5 old recovery-preparation database snapshots were removed **after**
the two new snapshots passed integrity checks. The unused Restic password
file `~/.local/state/termux-recovery-secrets/restic-password` was deleted.
No initialized Restic repo was found at the checked recovery locations.
**No application source database, live service, media or credential was
modified or deleted.**

## Full plaintext Termux archive — first attempt HOLD

Samsung task `termux-rebuild-plain-full-archive-20261114-v1` has a terminal
`failed` receipt (command exit 1). Internal `tar` returned 0 but emitted
**16 warning lines**, so the safety wrapper deliberately refused to mark it
ready. A `termux-home-usr.tar.partial` file remains; do **not** assume it is
usable or delete it blindly. No validated `termux-home-usr.tar` or checksum
has been confirmed. Snapshot DBs remain independently checked. The first read-only
BACKUPS scan `termux-rebuild-backups-folder-scope-readonly-20261114-v1`
failed before command startup (exit 125). Follow-up task
`termux-rebuild-backups-diagnostics-readonly-20261114-v2` completed PASS:
Android `/storage/emulated/0/BACKUPS` contains `PhotoMap` (18,638,728 KiB)
and `WreckScanner` (2,828,012 KiB), total 21,466,743 KiB. This folder is
**outside** the private `home + usr` TAR and cannot be treated as disposable
without deeper content comparison. Downloads `Plain-20261114-v1` contains
2 checked SQLite files, a package list and manifest, plus an **unqualified**
`termux-home-usr.tar.partial` of **33,027,737,600 bytes**; no final TAR and
no checksum file. Android Downloads free at inspection: 89,890 MiB.
The deeper read-only inventory and full TAR member-list check
`termux-rebuild-backups-deep-and-tar-readonly-20261114-v1` were submitted.
Do not make another space-consuming archive or delete data until the result
is checked.

## BACKUPS legacy 7z and full-TAR listing results

Detailed Samsung inspection (tasks
`termux-rebuild-backups-deep-and-tar-readonly-20261114-v1` and
`termux-rebuild-7z-and-full-tar-verify-20261114-v1`) established:

- `/storage/emulated/0/BACKUPS/PhotoMap/PhotoMap.7z`:
  9,766,147,653 bytes, dated 2026-08-07, 41,210 entries.
- `/storage/emulated/0/BACKUPS/PhotoMap/backups.7z`:
  9,301,142,643 bytes, dated 2026-08-07, 4,052 entries.
- `/storage/emulated/0/BACKUPS/WreckScanner/WreckScanner.7z`:
  2,893,034,596 bytes, dated 2026-08-07, 29,676 entries.

The 7z tool listed all three without a password (`listExit=0`,
`encryptedEntries=0`); do not infer payload integrity or deduplication
from listing alone. These Android-shared archives are **not inside** the
Termux private `home + usr` TAR. Keep them until the user approves cleanup
after independent verified backup and unique-data review.

The 33,027,737,600-byte partial TAR's entire 1,021,353-entry index
was read successfully (`tar -tf` exit 0, no read warnings) and includes
IleStoi DB, 778 field/390 private photo directory roots, PhotoMap managed
media directory, Local Agent, SSH, Cloudflare, runit, PocketHost, and
Termux `usr/etc`. This validates member headers and required path presence,
not a complete file-by-file payload restore. Prior creation emitted 16 warnings
without a nonzero TAR exit. The promotion task
`termux-rebuild-promote-plain-tar-after-restore-samples-20261114-v1`
completed **done / exit 0 / PASS**. It successfully extracted and checked
both SQLite databases from the TAR (`PRAGMA quick_check = ok`), computed
SHA-256 of the 33,027,737,600-byte archive, then atomically renamed it to
`termux-home-usr.tar`, wrote `termux-home-usr.sha256` and updated the manifest.
SHA-256: `c6a4e363b3fa14e47d0870b14a1c408e9ce382098504917eebcd268221b05584`.
The original creation emitted 16 warnings from live files; preserve separate
online SQLite backups as the canonical database recovery source. **This is a
verified TAR listing, sampled extraction and checksum, not a full isolated
1:1 restore or a verified off-device disaster-recovery copy.**

A user-facing plaintext restoration guide was additionally written to
`Plain-20261114-v1/README-ODTWORZENIE.txt` by Samsung task
`termux-rebuild-plain-restore-readme-20261114-v1` (done / exit 0 / PASS).
The guide explicitly warns against restoring the old `usr` tree wholesale,
explains SHA-256 and SQLite checks, and identifies Android `BACKUPS` as a
separate archive tree. The **next external gate is an independent off-phone
copy with checksum verification**; there is no evidence of this yet.

## Remaining protection gates

1. Check full plaintext TAR terminal receipt, size, SHA-256 and representative
   media/service paths; do not falsely call an incomplete archive ready.
2. Verify IleStoi and PhotoMap media presence and consistency in the TAR.
3. Copy Downloads recovery folder independently to trusted/offline storage;
   verify SHA-256 on the second device. An Android Downloads copy on the same
   phone is **not** disaster recovery after phone loss.
4. Perform isolated test extraction plus restored SQLite integrity and media
   verification without touching currently running services.
5. **Do not delete original PhotoMap runtime/dev/managed databases** simply
   because there is one logical backup; those files are application
   artifacts. Any clean-up of active runtime paths requires proven
   ownership and a verified replacement.
6. Only after owner approval: install fresh Termux with no auto-start,
   restore packages and services individually, build SSH/GitHub/Local
   Agent/PocketHost controls, then Cloudflare/MQTT/IleStoi/PhotoMap,
   each with status, logs, backup, rollback, and checks.

No scheduler, GitHub Actions, Codex, Work, external service restarts or
unapproved erasure. All backups for this recovery must remain password-free.

## Owner-directed native plaintext backups and legacy cleanup (2026-11-14)

**Do not use passworded Restic for new backups.** Native projects are authoritative:

- **IleStoi** runs on Samsung. Its own
  `scripts/backup_data.py zip --output ... --no-image-check` produces a
  ZIP containing an SQLite online snapshot plus both photo trees, without
  optional secrets, password, or encryption. Verified receipt
  `termux-ilestoi-native-zip-plaintext-backup-20261114-v1`:
  `PASS`, CRC check passed, 2,640,078,896 bytes, 1,042 field-media files,
  390 private-media files, `secretEntries=[]`.
  Android:
  `Download/Termux-Recovery/Project-Native-20261114-v1/ilestoi-current-data-and-photos.zip`
  and adjacent `.sha256`.
- **PhotoMap production runs on Raspberry Pi Zero 2 W**, not on Samsung.
  The native `scripts/backup_local_data.sh --apply --no-prune --json`
  completed on the Pi, followed by replacing the script's copied SQLite file
  inside the backup with a consistent SQLite Online Backup snapshot.
  Receipt `pi-photomap-native-no-password-backup-20261114-v1`:
  `PASS`, database 19,574,784 bytes, SHA256
  `24814f4084ef6989e4e7966d77d9f7cf88f033cd619d8c37eb66516adf3f3ede`,
  195 places, 1,082 photos, 1,098 private media files (4,084,122,798 bytes),
  1,098 public media files (154,437,872 bytes).
  Location **on Pi only**:
  `/home/michal/src/PhotoMaps/backups/local-20261114-173500`.
  Native backup is plain and no pruning of prior Pi backups occurred.
  Direct trusted passwordless `ssh zero2` from Samsung failed (exit 255);
  **no PhotoMap production backup transfer to Samsung has been confirmed**.
- The owner-approved old Android
  `/storage/emulated/0/BACKUPS` folder has been deleted by
  `termux-delete-legacy-android-backups-after-native-pass-20261114-v1`.
  Only exactly three verified August 2026 archives were removed
  (`PhotoMap/PhotoMap.7z`, `PhotoMap/backups.7z`,
  `WreckScanner/WreckScanner.7z`): 21,960,324,892 bytes total,
  around 20.45 GiB. Receipt:
  `Download/Termux-Recovery/Project-Native-20261114-v1/legacy-backups-removed.json`.
  Old archive history is intentionally no longer available in that folder.
- A *separate* historical passworded Restic repository existed inside
  `~/WreckScanner/WreckScanner/.backups/wreckscanner-restic`, not in Android
  `BACKUPS`. After the current IleStoi ZIP passed, its dedicated runit
  `wreckscanner-backup` worker was put DOWN with a persistent `down`
  marker (the boot hook respects this flag). First cleanup task halted
  conservatively after detecting a possible process match; corrected task
  `termux-ilestoi-retire-restic-repo-after-stop-20261114-v2` returned
  `PASS`: historical Restic repo (~2,587,466 KiB) and
  `.restic_password` removed, web service `wreckscanner` still running.
  The old auto-backup worker must **not be restarted** unless the owner
  explicitly requests migration; new backups are manual/plain.
- **Caveat:** the previously validated 33 GB plaintext full Termux TAR
  predates the Restic cleanup; it may still contain the historic repo and
  password as data within an unencrypted TAR. The TAR itself has no password.
  It remains an emergency rescue archive; do not overwrite or purge it without
  an independently verified replacement. No device reinstall authorized.

## Next gates

1. PhotoMap Pi backup should be exported to an independent device/Android when
   a verified secure transfer route is available. Do not call Pi-local storage
   an off-device backup.
2. Existing Samsung rescue TAR and IleStoi ZIP must be copied off the phone
   and verified by SHA-256 before erasing Termux.
3. A clean Termux rebuild remains separate and requires owner approval.
4. Project documentation and future backup UI must reflect the choice of
   **native plaintext backups**, not legacy passworded Restic automation.

