---
status: proposed
owner: runtime
last_reviewed: 2026-11-06
purpose: Specify a project-owned versioned PhotoMap Debian PRoot runtime without activating the stopped import
---

# ADR-0009: Isolated PhotoMap runtime MVP

## Boundary

PocketHost may manage only the explicit instance `photomap-test` beneath `~/Projects/PocketHost-Managed`. The accepted source release `import-20261106`, independent original checkout, backups, imported SQLite and 2,196 media files remain untouched. Existing `photomap-dev` Debian PRoot is `external-unfrozen` and cannot be adopted as a rollbackable owned runtime. No runit registration, autostart, shared package update, public listener or external service operation is permitted.

The old `scripts/termux-dev.sh serve-debian` path mounts the original PhotoMap checkout and must not be used. PhotoMap `server.py` loads local environment configuration and automatically executes Alembic migrations on its standard main path; therefore the first smoke must never point at preserved imported SQLite. A future managed launcher must use a reviewed allowlisted entrypoint and independently checked writable test database before activation.

## Versioned layout and ownership

Each approved runtime version receives a dedicated, private directory beneath `instances/photomap-test/runtime/versions/<runtime-id>/`, containing a sealed Debian ARM64 PRoot root filesystem, isolated Python environment, manifest with exact runtime/source/dependency digests, and a separate mutable working set. Release source remains immutable. Runtime state and bounded logs are separate from both source and imported data. No symlink or path traversal may escape the fixed managed root.

The launcher must verify owner `pockethost`, instance ID `photomap-test`, source release, rootfs provenance, dependency lock hash, Python ABI, runtime version, port 8010 and `autostart=false`. Existing imported `runtime.json` retains `enabled=false` and `launch_allowed=false` until a subsequent device acceptance and explicit enablement decision. Missing, changed or inconsistent metadata fails closed. PRoot runs as the same Termux OS user: it offers filesystem and dependency separation, **not a hostile-code security boundary**.

## Manual lifecycle port

A typed runtime port exposes `inspect`, explicit `start`, exact-owner `stop`, `health` and bounded redacted `logs` for one fixed ID. Only the host adapter may use `spawn`, filesystem mutation, `/proc`, signals or network probes. No method accepts an arbitrary command, PID, directory or port from an HTTP caller.

The adapter must check a private owner marker with process PID, Linux start ticks, executable, working directory, exact launch arguments and release/runtime identifiers. A matching PID alone is insufficient. Stop sends a graceful signal **only to the verified owned process**, never to an inferred listener, foreign process or broad process group. Port collision, a stale marker, unverified child process, startup timeout or a port left open after Stop results in a safe `unknown/HOLD` state. Logs are capped, sanitized and never reveal credentials.

The first manual Start/Stop implementation is disabled by default and must not mutate the existing P4 read-only catalog or P3 demo. Separately approved, same-origin loopback controls are a later gate after the isolated rootfs and exact ownership have passed native tests. No implicit restart or boot registration.

## Storage and acceptance

Use an independent test SQLite work copy and scoped media working set for the initial health smoke. Do not re-copy the 4.26 GB media tree automatically or use the original/accepted database as a writable migration target. Require a disk-space plan, SQLite backup/integrity checks and explicit snapshot strategy before any realistic data-backed smoke. If migration is unavoidable, run it only against the work copy.

Samsung acceptance must cover owner forgery, symlinks, PID reuse, changed start ticks, mismatched executable/cwd/argv, port conflict, failed Start, timeout, graceful Stop, idempotent Stop, orphan detection, log redaction and exact HTTP health. Confirm port 8010 off at the end, P3 unchanged, all six external Termux services unchanged and IleStoi readiness. Do not claim this gate from mocks or from the P4 source tests.

Package plans and transactional rollback of source + Python runtime + SQLite/migrations + media are **deferred** until hardware runtime acceptance and demonstrated restore. No rollback or package button may be enabled on a partial snapshot.

## Staging outcome and unresolved activation contract — 2026-11-06

Samsung receipts now confirm two separate versioned rootfs copies and an independent disposable source/SQLite workset for `debian12-photomap-20261106-v1`, plus Python 3.11.2 with all eight required distributions. Exact `d5b5591` code passed 62/62 root tests and 6/6 host negative tests. This **staging acceptance does not turn this proposed ADR into runtime activation approval**. See [physical closeout](../checkpoints/2026-11-06-photomap-isolated-rootfs-python-qa-closeout.md).

The staged `debian12-photomap-20261106-v1` profile remains `staged-unapproved`, its `isolated_rootfs=false` activation guard is intentional, and no active version is selected. The currently coded PRoot launch path uses `/opt/pockethost-venv/bin/python` whereas observed Debian uses `/opt/photomap-venv/bin/python`. Reconcile exact runtime identity, interpreter, pinned requirements and fail-closed owner checks before considering activation. Keep original and imported data immutable and no autostart. The next separately authorized device gate must prove real controlled Start/health/Stop, exact child PID/executable/cwd/argv/start ticks, bounded cleanup and port 8010 off afterwards. Full-instance restore and package changes remain deferred.

## Source hardening sprint — activation still on HOLD

The launcher source now uses the previously physically verified guest interpreter `/opt/photomap-venv/bin/python`. The host adapter additionally requires a matching explicit profile `status=approved-manual`, `launch_allowed=true`, `activation_approved=true`, `isolated_rootfs=true` and `python_executable`, as well as the existing requirements, port and ownership checks. A copied but staged version must still fail closed even if a top-level manifest flag is changed.

These are **code-only safeguards pending the new Samsung same-SHA quality gate**. They do not grant permission to set any staged approval flags, write an active-version manifest or start a process. The process identity, PRoot lifecycle and real health/Stop gates remain open.
