---
status: accepted
owner: sites
last_reviewed: 2026-11-06
purpose: Record the resolved Samsung PhotoMap TEST runit regression and verified stopped managed import
---

# PhotoMap TEST — runit correction and managed import

## Final accepted state

- Only the **Samsung Termux PhotoMap TEST clone** was in scope. Production PhotoMap on Raspberry Pi, IleStoi.pl, Cloudflare and Local Agent were not modified.
- Runit `photomap-dev` was stopped and its exact service symlink removed. PhotoMap port `127.0.0.1:8010` stayed off. There is **no autostart**.
- The original PhotoMap checkout, including 10 local Git-status entries, was preserved and independently backed up.
- The private PocketHost managed filesystem at `~/Projects/PocketHost-Managed` was published atomically as release `import-20261106`. Imported source: **2,746** files; independent original-code backup: **3,011** files.
- SQLite and **1,098 private + 1,098 public** media files were copied with per-file SHA-256 checks. Total data size: **4,258,135,454 bytes**. SQLite size **19,574,784 bytes**, SHA-256 `24814f4084ef6989e4e7966d77d9f7cf88f033cd619d8c37eb66516adf3f3ede`; preflight SQLite integrity and foreign-key checks passed.
- All six separately monitored Termux services remained unchanged in the import task. IleStoi readiness previously returned HTTP 200.
- This receipt proves a **stopped copy**, not a runnable, isolated PhotoMap runtime or a full-instance rollback.

## Root cause of unintentional restart

The earlier PhotoMap preview on 2026-11-02 re-created the runit registration as part of testing and left the test instance running. The exact symlink timestamps and PhotoMap discovery checkpoint corroborate the regression; its long process uptime does not establish the registration time. A temporary preview must never register persistent runit autostart again.

## Device receipts and exceptions

| Local Agent task ID suffix                               | Terminal result  | Meaning                                                                                                                     |
| -------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `photomap-owned-stop-preflight-20261106-v1`              | done, exit 0     | Verified source, old service ownership and six external services                                                            |
| `photomap-stop-remove-autorestart-forensics-20261106-v2` | done, exit 0     | Stopped exact PhotoMap test service, removed its registration, preserved external services                                  |
| `photomap-independent-no-autorestart-20261106-v1`        | failed, exit 1   | False-positive matcher inspected its own diagnostic command; port was off, runit link absent and six other services running |
| `photomap-managed-import-preflight-20261106-v1`          | done, exit 0     | No PhotoMap service/listener, data integrity and free-space preflight                                                       |
| `photomap-managed-import-copy-20261106-v1`               | failed, exit 1   | Refused four live runit FIFO files during source backup; no final target published                                          |
| `photomap-import-symlink-diagnose-20261106-v1`           | done, exit 0     | Confirmed four runtime-only FIFO entries in two `supervise/` folders                                                        |
| `photomap-managed-import-copy-20261106-v2`               | **done, exit 0** | Skipped exactly those two runtime-only `supervise/` directories, verified the release and published it stopped              |

All listed task names have the common `pockethost-` prefix and are recorded in the **private** `MichalMatu/local-agent` repository, branch `agent-control`, under the exact Samsung installation. This checkpoint intentionally stores no private task payloads, PIDs, credentials or environment dumps.

## Cleanup and release constraints

The failed v1 copy left an isolated, unpublished staging directory with 1,780 files and 597,768,154 bytes. It was **safely removed** by the dedicated guarded Samsung task `pockethost-p4-closeout-obsolete-import-stage-cleanup-20261106-v1` (**done / exit 0**, `OBSOLETE_STAGE_CLEARED`), after verifying exact path, owner, counts and final published release. The authoritative managed root, original checkout and backups remain preserved. No broad `Projects` cleanup was performed.

The imported Debian PRoot environment is **external and unfrozen**. `runtime.json` retains `launch_allowed=false`, `enabled=false`, `autostart=false`; project-local package updates and entire-instance rollback remain disabled. The old runit script still points to the **original checkout**, not the managed release. Start/Stop requires a new owned runtime design and physical acceptance.

See [ADR-0007](../adr/0007-photomap-managed-instance-layout.md) and [P4 checkpoint](2026-11-06-p4-managed-photomap-catalog.md).
