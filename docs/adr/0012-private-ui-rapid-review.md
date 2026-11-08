---
status: accepted
owner: core
last_reviewed: 2026-11-08
purpose: Owner-authorized quick DEV panel iterations with scoped safety
---

# ADR-0012: Fast DEV review instead of repeated production gates

## Decision

PocketHost is **development code**. The existing owner-facing Termux
panel is a **DEV instance**, not a customer production service.
The owner requested rapid changes and repeated refresh/restart of
**that PocketHost-owned panel**, without a second preview deployment
or full audit after every small UX change.

Default: commit to `main`, run a narrowly relevant Samsung check
when useful, use Vite HMR or restart the one verified PocketHost
panel, get owner feedback, repeat. The previously documented
UI-only exact-SHA full G2/G3 gate at every restart is **superseded**.
This is not an exception requiring a separate ADR or approval each time.

## Testing tiers

- **Tiny visual/copy/CSS:** owner reviews in the running DEV panel;
  no mandatory full build, coverage or browser matrix.
- **Routes, interactive UI, controls:** `npm run dev:quick`, optionally
  `npm run dev:ui -- <focused-test>`. Report any failed or missing tests.
- **Core host, safety boundary, packages, external services, network,
  persistent data:** targeted negative/security gates before use.
- **Milestone closeout / actual customer release:** full
  `npm run dev:full` and applicable physical acceptance.

The standard commands and precise restart procedure are in
[the DEV iteration runbook](../DEV_ITERATION.md).

## Ownership and non-goals

This decision grants standing approval for ordinary **PocketHost-only
DEV panel** refresh/restart once its ownership is confirmed. A
restart must not select a process by name or port alone; require
the recorded owner and process start identity. Keep the last known
working SHA for rollback.

It does **not** grant authority over IleStoi.pl, Local Agent,
unrelated Termux services, user site processes or existing data.
It does not waive LAN restrictions, allow public administration,
install packages, enable boot startup or relax path/intent guards.
Do not force a blocked host operation. Use supported tooling
and report actual results.
