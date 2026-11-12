---
status: proposed
owner: observability
last_reviewed: 2026-11-10
purpose: Define the new read-only aggregation and history module
---

# Observability Module

**Basic Hosting boundary:** project website traffic analytics are
separate from Android-wide network telemetry. Obtain per-site
requests, visits and errors from approved Cloudflare APIs and/or
owned origin logs, with truthful availability labels. Do not gate
Basic Hosting analytics on Companion or Shizuku. Follow the active
[Hosting roadmap](../ROADMAP.md); existing Pro-native telemetry
code is preserved but frozen.

## Responsibility

Aggregate **already admitted read-only** metrics and events
into versioned snapshots and bounded time series. This is a
registered module with source-candidate in-memory aggregation, live
probes and a dashboard. None is device accepted on the final SHA.

The five O1 capabilities retain their owner modules:

1. Host Monitor: `host` probes CPU, RAM, disk, optional
   battery/network and runit services.
2. Process Inspector: `host` observes bounded accessible
   process trees and resource counters; ownership is separate.
3. Runtime Diagnostics: `diagnostics` and `runtime` supply
   redacted events and dry-run recovery decisions.
4. Package Inventory: `packages` owns installed versions
   and optional read-only update metadata.
5. Dashboard: `apps/admin` renders these typed results.

`observability` normalizes and summarizes these sources;
it cannot read from other feature modules' internals or
execute host commands.

## Implemented source contract

Provide snapshot version, observed timestamp, source, unit,
bounded history and state `ok`, `stale`, `unavailable` or
`permission-denied`. Missing values remain missing, never
silent zeros. Distinguish whole-phone counters from the
PocketHost-owned instance and do not claim a complete
Android process listing. Rate, payload and retention
limits must be explicit.

## Acceptance

`src/modules/observability/overview.ts` retains at most 36 on-demand
CPU/RAM samples, 20 sanitized runtime events and 12 alerts. PID identity
comparison includes start ticks. Data never grants control. The original
structured PhotoMap TEST event reader is reused read-only; no second
process lifecycle mechanism has been introduced. Diagnostics for other
application types, persistent historical snapshots and complete Android
process visibility are not yet delivered.

Require deterministic negatives for stale data, partial
Android `/proc` visibility, redaction, PID reuse, cardinality
and retention; real read-only Samsung measurements
and exact-SHA source gates. Preserve six external
services and PhotoMap port 8010. See
[ADR-0010](../adr/0010-read-only-observability.md)
and [the roadmap](../ROADMAP.md).

## Accepted cross-source telemetry direction — 2026-11-10

The target **single PocketHost Android app** integrates the
existing Android Companion/Bridge and optional authorized Shizuku.
It reuses the existing Termux Node.js host and `observability`
aggregator; this is not a second monitoring daemon or a declaration
that a unified Android application is installed.

The main Dashboard may render real read-only Android CPU,
battery and other permitted Bridge metrics alongside Termux RAM,
storage, visible processes and runit observations. The source,
device/Termux scope, timestamp, unit and `ok` / `stale` /
`unavailable` / `permission-denied` state must remain visible
or recoverable. No inaccessible value silently becomes zero.

On the current Samsung the Termux UID is denied access to
`/proc/net/dev` and `/sys/class/net/*/statistics/*`.
The native `NetworkStatsManager` route is **planned**, subject
to separate permissions and device acceptance; it is not a
real-time throughput feed until accuracy is proven. Bounded
network reachability and latency from Termux are a valid
first trend. A future SQLite store needs sampling and retention
limits; no durable 24 h history is claimed today.

Canonical architecture: [ARCHITECTURE](../ARCHITECTURE.md).
Approved first-screen composition:
[TARGET_INFORMATION_ARCHITECTURE](../TARGET_INFORMATION_ARCHITECTURE.md).

## Physical Samsung battery source — 2026-11-08

Samsung Android denies reading `/sys/class/power_supply/battery/capacity`
from the Termux app. Termux:API CLI was already installed, and the matching
F-Droid Android companion (0.53.0) was installed via authorized Mac ADB
with exact APK signer verification. SSH returned a real battery percentage.
On demand, `host` first attempts its existing sysfs battery reading and
then tries the fixed `termux-battery-status` executable asynchronously,
with a 7.5-second deadline and a 4 KiB output cap. It only admits an
integer percentage 0–100; failures preserve the original missing state.

CPU access to `/proc/stat` is denied and Node `os.cpus()` reports no CPUs
on this device. Android `top` repeatedly reports all cores idle and is
not an authoritative system-wide utilization fallback. CPU therefore
remains explicitly unavailable until a verified measurement source exists.

## Termux vs. Android / Shizuku monitoring split — 2026-11-08

The standard **Termux monitoring** screen only displays values genuinely
available to the Termux process: RAM, Termux filesystem storage,
Termux:API battery when its backend fallback is active, visible processes,
process CPU ticks and service observations. The main CPU tile is now
**Termux-visible processes**, not a fake system-wide utilization reading.
A process CPU tick counter is cumulative, never equivalent to current CPU %.
The old blank CPU history view is removed from normal monitoring.

Full Android CPU, Android-wide process/service observation and power-user
controls originate from the authorized **Android Companion & Shizuku**
subsystem. Detailed controls stay in **Android & Shizuku**; the future
main Dashboard may display its verified read-only telemetry with
source and freshness. Shizuku Manager alone is insufficient.
