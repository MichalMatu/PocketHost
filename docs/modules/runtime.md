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

## Generic runtime extraction — accepted as source, not live PhotoMap

The reusable `ManagedRuntimeSnapshot`, `ManagedRuntimePort` and `createManagedRuntime` contracts separate ownership/state-machine policy from an app adapter. PhotoMap now supplies only its fixed identity, port, release and legacy errors to this engine. A second synthetic project receives the same fail-closed policy in deterministic tests without importing PhotoMap constants. This is **source refactoring**, not activation of the disabled PhotoMap host process.

Next extraction target: app-neutral host process identity/PRoot child evidence, followed by versioned adapter registration and schema validation. No app may be adopted by mere process/port discovery.

## Application-neutral registry — 2026-11-07

`createManagedRuntimeRegistry` accepts only explicit unique ID/port bindings
implementing the shared runtime port. An unrelated synthetic project uses the
same fail-closed state machine in tests without PhotoMap imports. The separate
PhotoMap profile supplies its fixed identity and release; it does not define
or enable the generic engine. Runtime registration is not discovery, adoption,
provisioning, publication or permission to activate a disabled import.

At exact source `bc5e553`, Samsung `check:all` passed 101/101 Node tests and
16/16 UI tests. This qualifies the generic source contracts, not physical
PhotoMap PRoot Start/Stop or orphan recovery. See the
[final native checkpoint](../checkpoints/2026-11-07-final-native-qa-handoff.md).
