---
status: accepted-with-follow-up
owner: sites
last_reviewed: 2026-11-06
purpose: Preserve exact diagnosis and correction of unintended PhotoMap TEST service autostart on Samsung
---

# PhotoMap test runit autorestart regression — stopped and unregistered

## Scope

Only the **Samsung Termux test clone** at `$HOME/Projects/PhotoMap` and its own exact registered runit entry `$PREFIX/var/service/photomap-dev`. The owner explicitly instructed: PhotoMap TEST must remain stopped, runit autorestart is a bug, PhotoMap production on Raspberry Pi Zero and IleStoi.pl are outside scope. No package install, host reboots, database writes, source modifications, or operations on other runit services.

## When and why the regression appeared

- **2026-11-01:** [PhotoMap's approved closeout](https://github.com/MichalMatu/photomap/blob/d49e94c93320e6368344d46b684e829487d8f0a5/docs/checkpoints/2026-11-01-samsung-termux-photo-data-test-closeout.md) documents TEST instance **OFF** and `$PREFIX/var/service/photomap-dev` symlink **removed**, preventing automatic start.
- **2026-11-02 20:12:49.178 UTC = 21:12:49.178 Europe/Warsaw:** exact filesystem `lstat` `mtime` and `ctime` of the specific `photomap-dev` symlink both point to its re-creation, matching the parent service directory `mtime`. The service run script itself was last modified on Nov 1, and was not a new source change.
- **Nov 2 Samsung discovery drawer preview:** [the contemporary device checkpoint](https://github.com/MichalMatu/photomap/blob/d49e94c93320e6368344d46b684e829487d8f0a5/docs/checkpoints/2026-11-02-samsung-termux-discovery-preview.md) explicitly records that runit `photomap-dev` was *reconnected after frontend build*, and that the test instance was **left running** for manual review. This explains the registration regression. It was not closed out by disabling the service after preview.
- **Nov 6 physical preflight:** runit child `proot ... photomap-dev` and its sole guest `/opt/photomap-venv/bin/python /mnt/server.py` served `127.0.0.1:8010` (GET health/root 200). Service status reported more than 91,000 seconds of process uptime; process uptime is **not** the date when the autostart symlink was registered.

## Authorized correction and physical evidence

Exact host/installation: Samsung `android-termux-10520` / `6be16f1d-194b-4f07-b377-3d4bb218fcd7`. Task results are private in `MichalMatu/local-agent` / `agent-control`.

- `pockethost-photomap-owned-stop-preflight-20261106-v1`: `done`, exit 0; exact service symlink resolved only into `$HOME/Projects/PhotoMap/.dev/termux/process/runit/photomap-dev`; service run script verified; parent `runsv` / child PRoot / Python guest inspected; host source `d49e94c9` with existing worktree changes. Six independent Termux services and IleStoi health 200.
- `pockethost-photomap-stop-remove-autorestart-forensics-20261106-v1`: **failed before all mutations**, due to an overly escaped process-PID regex; no service actions.
- `pockethost-photomap-stop-remove-autorestart-forensics-20261106-v2`: **done, exit 0**, `PHOTOMAP_TEST_STOPPED_AUTORESTART_REMOVED`. Revalidated exact symlink, run script SHA, expected PRoot/guest ancestry and all six external service states, then ran only `sv down` on `photomap-dev`, unlinked only the exact `$PREFIX/var/service/photomap-dev` symlink, and sent SIGTERM only to the verified PhotoMap guest Python PID and PRoot PID when necessary. HTTP port 8010 stopped, service link absent, six external services unchanged, IleStoi readiness HTTP 200.
- Source tree, dirty local changes, frontend build, SQLite (195 places; 1082 photos), 1098 original-media files, 1098 public derivatives, and the Debian PRoot environment were intentionally left intact.
- Extra read-only persistence check `pockethost-photomap-independent-no-autorestart-20261106-v1` is queued for a separate 12-second post-stop inspection; do not claim reboot persistence solely from this short gate.

## Regression prevention

Runit registration must **not** be used to run a temporary PhotoMap test preview: it persists after tests and restarts services independently. Future PocketHost-managed PhotoMap execution must be manual, owned by a strict PID/start-ticks record, disabled by default, and have an explicit stop/cleanup finalizer. Prevent recreation of `$PREFIX/var/service/photomap-dev` during UI testing. Test code may not call generic `sv up` or `ln -s` for this instance.

[ADR-0007](../adr/0007-photomap-managed-instance-layout.md) defines the eventual backed-up managed copy under `$HOME/Projects/PocketHost-Managed`. **No files or gigabytes of media have been moved yet.** Keep the source checkout as a fallback; import/copy requires a distinct verified transaction and rollback manifests, not a symlink from the original data to the managed instance.
