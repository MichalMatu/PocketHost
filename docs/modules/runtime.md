---
status: accepted
owner: runtime
last_reviewed: 2026-11-05
purpose: Define the runtime module contract
---

# Runtime Module

## Responsibility

Manage lifecycle only of explicitly PocketHost-owned server instances. P3 introduces a restricted, opt-in single-site implementation candidate; no foreign-process adoption.

## Inputs and outputs

The P3 candidate's typed `OwnedSitePort` exposes inspect, create, start, stop, publish, rollback and bounded logs for a fixed demo ID. Every mutation requires the current snapshot to identify `ownership: pockethost`; an absent or externally owned site cannot be started or stopped. All filesystem and process side effects remain in the host adapter. This interface is DEV-only and not a general remote process manager.

## P4 PhotoMap hold

The `photomap-test` import is a verified stopped filesystem copy. Its external Debian PRoot is not an isolated, rollbackable runtime, and its old run script still targets the original checkout. The P4 catalog refuses to enable start/stop without a new explicit runtime adapter, isolated dependencies, owned process identity, exact loopback readiness, and negative device tests. A successful import does not authorize a start operation.

## Forbidden

No action on processes discovered by inventory; no PID-only ownership; no implicit auto-restart.

## Quality

Tests cover ownership proof, port collision, failed startup, shutdown and cleanup without touching other services.

## Acceptance state

The candidate is not released. Native feature tests, negative HTTP tests and actual phone-browser lifecycle acceptance remain mandatory before controls can be enabled.

## PhotoMap isolated runtime — inert code accepted, not activated

The typed `PhotoMapRuntimePort` and pure `createPhotoMapRuntime` policy now cover fixed `photomap-test` ownership, a version identifier, inspect, guarded manual Start/Stop, health and redacted bounded event logs. The separate host adapter is not wired into the live UI. On Samsung, exact source `32c09f2c` passed 60/60 root tests, 9/9 targeted runtime tests and the full formatting/lint/types gate; the actual imported instance denied Start/Stop, with port 8010 off. [Terminal checkpoint](../checkpoints/2026-11-06-photomap-runtime-inert-native.md).

Staged Debian rootfs copies **do now exist** (`debian-arm64-v1` and `debian12-photomap-20261106-v1`). The latter has a disposable source and SQLite working copy; an on-device read-only Python 3.11.2 smoke verified eight dependency versions. Source at `d5b5591` passed **62/62** root tests and **6/6** host negatives. See [staging checkpoint](../checkpoints/2026-11-06-photomap-isolated-rootfs-python-qa-closeout.md). The imported manifests are still disabled; no active version, live health/PID/Stop acceptance, autostart or package update is authorized. The current log implementation records bounded events, not accepted backend stdout/stderr.
