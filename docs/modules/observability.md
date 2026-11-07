---
status: proposed
owner: observability
last_reviewed: 2026-11-07
purpose: Define the new read-only aggregation and history module
---

# Observability Module

## Responsibility

Aggregate **already admitted read-only** metrics and events
into versioned snapshots and bounded time series. This is a
registered module contract **without implemented collectors,
background sampling or a completed UI**.

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
Android `/proc` visibility, redaction, PID reuse, cardin-ality
and retention; real read-only Samsung measurements
and exact-SHA source gates. Preserve six external
services and PhotoMap port 8010. See
[ADR-0010](../adr/0010-read-only-observability.md)
and [the roadmap](../ROADMAP.md).
