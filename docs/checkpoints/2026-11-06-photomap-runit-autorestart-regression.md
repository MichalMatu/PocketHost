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

## Independent post-stop result and migration handoff

The read-only task `pockethost-photomap-independent-no-autorestart-20261106-v1` **finished failed / exit 1**, but its recorded observations were: port 8010 unreachable both before and after 12 seconds, runit symlink absent, original PhotoMap directory and service run script preserved, all six other monitored services `running`, IleStoi readiness 200, no shell/boot startup matches. Its process-name test erroneously matched the *diagnostic's own* `sh -c python3 -B - <<'PY'` command text, so the overall `pass:false` is a diagnostic **false positive**, not proof of a newly running PhotoMap. Do not relabel the task PASS or infer reboot persistence.

A separately published read-only task `pockethost-photomap-managed-import-preflight-20261106-v1` checks exact source identity, runtime stopped, private media inventory, SQLite integrity and free capacity before the authorized copy. **As of this checkpoint the terminal task result is unavailable; no managed files have been copied or published and the preflight must not be reported as passed.**

On a genuine PASS, execute the distinct ADR-0007 staged copy transaction with content hashes, an immutable source backup, ownership manifests and disabled runtime. Keep the original checkout untouched, no PhotoMap runit autostart, and no process or filesystem changes involving IleStoi, production PhotoMap on Raspberry Pi, Cloudflare or the Local Agent. A package/runtime-wide rollback remains blocked until an independently restorable PRoot+dependency snapshot has been created and physically tested.

### Samsung managed-copy preflight accepted (independent native receipt)

The separate read-only task `pockethost-photomap-managed-import-preflight-20261106-v1` returned **done / exit 0 / PASS** at 2026-11-06 04:24:12 UTC. Evidence: no PhotoMap runit link, HTTP port 8010 off, no matching PhotoMap server process, six external services `running`, IleStoi readiness 200, source HEAD `d49e94c93320e6368344d46b684e829487d8f0a5` with **10 local Git status entries** to preserve. The 19,574,784-byte SQLite had SHA-256 `24814f4084ef6989e4e7966d77d9f7cf88f033cd619d8c37eb66516adf3f3ede`, `integrity_check=ok`, no foreign-key errors; media count **1098 private + 1098 public**, with historical sizes matched. Available host space: **135,229,431,808 bytes**. The destination `PocketHost-Managed` did not yet exist.

The owner-authorized separate immutable import task `pockethost-photomap-managed-import-copy-20261106-v1` was then published to the **same Samsung installation**, limited to a private staging root, source+dirty Git backup, per-file SHA-256 copies and atomic publish. As of this documentation change **its terminal result is not yet available**. Publication is **not** evidence that the copy or adoption finished. No start, autostart, package installation, global upgrade or control of foreign services was requested.
