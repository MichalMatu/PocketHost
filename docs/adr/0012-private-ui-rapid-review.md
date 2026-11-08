---
status: owner-approved-conditional
owner: core
last_reviewed: 2026-11-08
purpose: Short private-LAN UX iteration releases with strict PocketHost-only rollback
---

# ADR-0012: Fast UX iteration gate for the private PocketHost panel

## Owner decision

The owner explicitly requested faster development iterations on 2026-11-08:
change UI, perform focused verification, release the PocketHost-owned
panel for personal review, then repeat. Expensive full-suite tests and
coverage can run at major closeouts rather than after every visual
iteration. This narrows the normal exact-source full G2 requirement
for **UI-only private preview iterations**; it does not authorize
skipping safe deployment preflight or modifying Termux services.

## Eligibility

- Change is limited to admin UI, routing, tests and documentation.
  No altered host adapter, service controls, package commands,
  ownership policy, auth boundary, persistent data or listener.
- The last changed UI code has a native Samsung TypeScript/Vite
  build, lint and focused UI tests PASS; any later changes are
  strictly bounded to test expectations or documentation.
- New exact target SHA passes a brief native source check:
  preserved 32 upstream routes, structure/docs, formatting,
  and focused module navigation tests. A new failed result is HOLD.
- The production script verifies old panel source and PID/start ticks,
  exact physical site digests, registered protected services and
  current LAN listener ownership before stopping **only** the
  PocketHost preview process. The script captures fallback records,
  restores on failure, probes the new UI, and verifies original sites
  and foreign services unchanged after LAN restoration.
- Public internet exposure, autostart, package mutation, PhotoMap
  activation, terminal startup, external service restarts and schema
  migration are strictly excluded.

## Acceptance boundary

This is a conditional exception for user-visible **trusted-LAN preview**
rather than final G2/G3 product acceptance. Do not mark a task PASS
until its real Samsung result was retrieved and checked. Browser
click-through and full quality matrix remain open to the closeout.
If any preflight cannot establish ownership or rollback safety,
do not deploy or blindly retry a partially executed task.
