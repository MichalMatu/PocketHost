# Host Module Agent Instructions

## Scope

Only host adapter for Termux process/filesystem/runit,
owned static-site lifecycle, private registry storage and
Android Companion forwarding. Read the specific
[host contract](../../../docs/modules/host.md) on demand.

## Forbidden

No scan outside explicitly approved roots, unknown-PID
signalling, automatic package installs, credential dumps,
service adoption or modification of external Termux
workloads. Generic command execution is not an internal
fallback. The owner-approved **direct Shizuku Advanced
Shell** is a distinct explicit typed action through
Android loopback, bounded by real Shizuku permissions,
not a host-wide automatic arbitrary shell API.
No WAN or wildcard listener.

## Gate

Only act on exact verified target ownership; deny symlinks,
traversal, stale version/owner, mismatched start ticks/cwd
and foreign processes. Add focused positive and negative
tests for changed operations, timeout/failed exits and
rollback where relevant. Execute tests exclusively via
verified Samsung Termux Local Agent. Do not repeat
unaffected suites.

The existing **PocketHost DEV panel only** may autostart
under owner-approved Termux runit; no hosted project or
external service inherits that exception (ADR-0014).
