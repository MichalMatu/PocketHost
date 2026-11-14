---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Safe clean-Termux rebuild from encrypted recovery evidence
---

# Termux rebuild — inventory, backups, clean bootstrap

## Intent and hard fence

Preserve the complete existing Samsung Termux installation for **recovery**, then
build a **new empty Termux with no auto-started services**. Restore application
data into freshly configured services, not the old package tree, daemon launches
or Termux:Boot hooks wholesale. Each newly owned service gets a dedicated
PocketHost control page with one source of metadata, lifecycle, health,
redacted logs, backup and rollback. Existing external services remain protected.

**Inventory and private SQLite staging are complete. Five consistent SQLite
snapshots were created and checked on 2026-11-14; they are NOT encrypted,
exported, or sufficient disaster-recovery backups. No files have been copied
to Downloads, no restic repository has been created, no service has been stopped
and no reinstall is authorized.**
Before any destructive step require verified backups, off-device copy, working
restore and explicit owner approval. Never leak credentials, private photos or
restic passwords into Git tasks/reports.

## Samsung read-only inventory (2026-11-14)

Independent host tasks (Git branch `MichalMatu/local-agent:agent-control`):
`termux-rebuild-readonly-storage-inventory-20261114-v1`,
`termux-rebuild-database-media-detail-20261114-v1`,
`termux-rebuild-canonical-data-check-20261114-v1`.

- Android `Download` is the target of `~/storage/downloads` and has
  approximately **121,249 MiB free** at inspection. Public/shared storage is
  **not an appropriate location for unencrypted secrets or photos**.
- Installed packages: **461**; essential candidates include OpenSSH, Git,
  Python, Node.js, restic, SQLite, proot/proot-distro, mosquitto, cloudflared,
  runit and termux-services. Export an exact package/version manifest.
- Main Termux runit entries: `cloudflared`, `cupsd`,
  `ilestoi-healthwatch`, `mosquitto`, `pockethost-panel`,
  `pockethost-panel-watch`, `ssh-agent`, `sshd`, `tx11`,
  `tx11-xfce4`, `wreckscanner` and `wreckscanner-backup`.
  Local Agent uses its separate private runit. Boot hooks:
  `~/.termux/boot/00-services` and `90-local-agent`.
- **IleStoi active runit cwd:** `~/WreckScanner/WreckScanner`.
  Main SQLite candidate `~/WreckScanner/WreckScanner/wreckscanner.sqlite3`
  is 663,552 bytes. The same tree contains 778 field photos (~1.03 GB)
  and 390 private photos (~1.63 GB), together 1168 files (~2.66 GB).
  Project tree ~5,310,705 KiB. Historical `~/IleStoi-Backups`
  ~19,880 KiB; additional historical data in `~/.local/state/ilestoi-ops`.
  Protect the live SQLite database, WAL/journal if present, private and
  public media, app configuration, relevant service definitions and history.
- **PhotoMap managed TEST import:** `~/Projects/PocketHost-Managed/instances/photomap-test/data`
  ~4,166,970 KiB, including `media/` 2093 images (~3.88 GB) and
  `database/app.db` 19,574,784 bytes. Development source database:
  `~/Projects/PhotoMap/.dev/termux/data/app.db`.
  Those two SQLite files have **identical hashes** in the read-only snapshot.
  Two additional `runtime/versions/*/work/database/app.db` files also match
  **each other** but not the first pair. Preserve **both database version
  groups** until application ownership/schema/runtime migration is proven.
  `~/Projects/PhotoMap` totals ~5,008,618 KiB;
  managed test instance ~6,234,231 KiB; dev proot rootfs under
  `$PREFIX/var/lib/proot-distro/containers/photomap-dev` ~415,005 KiB.
  A managed TEST copy is not automatically the active PhotoMap deployment.
  Avoid counting duplicated runtime/test fixtures as separate primary data.
- SSH private state (`~/.ssh`), Cloudflare tunnel credentials
  (`~/.cloudflared`), MQTT configuration (`$PREFIX/etc/mosquitto`),
  runit definitions, local-agent private state, PocketHost-owned sites,
  app settings, logs required for diagnosis, Git remotes/revisions, Termux
  settings and boot hooks require inventory and encrypted preservation.
  No secrets were read into the inventory report.
- The restic executable is installed. **No initialized restic repository was
  identified in the inspected standard locations.** Do not claim an existing
  usable disaster-recovery snapshot. The PocketHost restic integration's
  default state is under `~/.local/state/pockethost/h3-restic`, inside
  Termux private storage; it is not an off-device backup.

## SQLite staging completed (2026-11-14)

Samsung exact-installation task `termux-rebuild-sqlite-snapshot-20261114-v1`
finished `done` with command exit 0, five database snapshots, and SQLite
`PRAGMA quick_check = ok` for each. Includes the running IleStoi DB and all
four PhotoMap DB locations (both differing version groups) plus the exact
461-package manifest. Private staging only:
`~/.local/state/termux-recovery-prep/20261114-db-snapshot-v1`.
Media and complete `home + usr` are NOT yet backed up; no password or keys
were exported; no off-device or isolated-restore proof exists. Keep the
stage private and leave services untouched. These copies are not a PASS for
Termux erasure or reinstall.

The initially generated password was visible in a chat screenshot and is
therefore **retired**. Samsung exact-installation task
`termux-rebuild-rotate-restic-password-preflight-20261114-v1` completed `done`
with command exit 0, rotated the password in place, and confirmed mode 0600.
The NEW password remains local in
`~/.local/state/termux-recovery-secrets/restic-password`; its contents
were not transmitted through Git. **Off-phone custody of the NEW password
has NOT been verified; do not initialize Restic yet.** User must securely
save it in a separate password manager/device without screenshots or sharing
it in chat, Git tasks, output logs, or Downloads.

Read-only preflight: `home=28,897,305 KiB`, `usr=4,983,619 KiB` (about
32.3 GiB combined); available `121,394 MiB` on Android Downloads at task
time. Five SQLite snapshots are present. No preexisting recovery Restic repo
at the checked destination; no service changes. Size is not a proof of
Restic success. After confirmed password escrow, initiate encrypted full
backup, off-device export, and isolated restore.

## Next phase — Restic, export and proof (NOT YET EXECUTED)

1. **Consistent app snapshots completed.** Five online SQLite snapshots and
   a package manifest are staged privately with quick-check evidence. Preserve
   this immutable batch and capture media/content manifests before any export;
   do not mistake these staged database files for the final recovery backup.
2. **Encrypted full-rescue layer.** Make a fresh restic repository with
   independently escrowed recovery password; capture both
   `$HOME` and `$PREFIX` (with repository/cache recursion excluded),
   including app-private metadata, package/version list, service definitions,
   boot scripts, keys/config and all owned data. In addition retain logical
   app-level backups for IleStoi and PhotoMap. Do not overwrite old backup
   files or treat existing duplicate content as expendable.
3. **Export.** Transfer only encrypted archives/repository plus non-secret
   manifest/checksums to `~/storage/downloads/Termux-Recovery/`, then
   independently copy them off the phone (e.g. Mac). Never store the restic
   password in the same Downloads repository or GitHub; establish independently
   recoverable password custody before writing encrypted data.
4. **Proof.** Verify snapshots/repository integrity and checksum/size after
   copying; restore into isolated staging and inspect SQLite/media presence.
   Mark a backup READY only after both on-phone and off-phone restoration
   evidence. Confirm available space before starting.
5. **Clean bootstrap only after owner approval.** New Termux must begin
   without any reinstalled services or inherited autostart scripts. Rebuild
   clean packages and new service registry. Do not auto-restore all of
   `$PREFIX` or launch historical runit/Boot scripts.
6. **Controlled service-by-service restoration:** baseline Termux/storage;
   SSH and trusted GitHub access; independent Local Agent; PocketHost core
   control panel and backups; Cloudflare/tunnel; MQTT/monitoring; IleStoi
   DB/media; PhotoMap DB/media; optional desktop/CUPS/other services only on
   explicit need. Each stage: own process attestation → dedicated page
   (status, controls, logs, config, backup/rollback) → checked startup →
   recovery evidence. Never duplicate service state across pages.

## Required go/no-go before erasure

- Both primary SQLite datasets and both PhotoMap version groups preserved.
- IleStoi private+public images and PhotoMap managed images present.
- Full `home + usr` rescue, package list and credential custody verified.
- Encrypted Downloads copy **and** independent off-device copy confirmed.
- Successful isolated restore and ownership/service manifests reviewed.
- Owner explicitly authorizes any stop, reinstall or data deletion.

**Do not modify current services during inventory.** A Git task receipt, a
listed restic repository or an HTTP 200 by itself is not a recoverability proof.
