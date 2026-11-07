---
status: proposed
owner: core
last_reviewed: 2026-11-07
purpose: Record the safe read-only Observability module boundary
---

# ADR-0010: Read-only Observability

## Decision

Create one `observability` aggregation module, not a
second process supervisor or five duplicate executors.
`host` retains OS/process probes; `runtime` retains
verified owned lifecycle state; `diagnostics` owns
events; `packages` owns software inventory;
`apps/admin` presents the results.

## Safety

- Default to foreground/on-demand bounded sampling.
  No always-on daemon, autostart, Shizuku setup or
  new permissions in O1.
- Distinguish real, stale, unavailable and forbidden
  readings. Android `/proc` and `/sys` may be restricted.
- Bound cardinality, sampling rate, history and output.
  Do not expose secrets, raw arguments or private paths.
- Observation is not ownership. A PID, port or service
  name cannot authorize signals.
- No kill, restart, auto-repair, `pkg install`, global
  updates, public API, original PhotoMap mutation
  or live PhotoMap Start.
- Recovery remains a dry-run recommendation unless
  separately approved and physically tested.

## Open-source references

Study tdash, Android Dev Hub, Coolify, CasaOS and
Termux App Store for patterns, not bulk copying.
Record exact project, license, version and Samsung
compatibility before reusing code. GPL sources may
inform designs, but copying needs a separate license review.

## Gate

Each functional slice requires negative tests,
exact-SHA Samsung source checks, read-only physical
measurements and unchanged six protected services.
Real P3 browser interaction and PRoot recovery
remain independent release holds.
