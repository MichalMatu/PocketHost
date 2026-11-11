---
status: source-implemented-validation-open
owner: ui
last_reviewed: 2026-11-10
purpose: Monitoring separation and generic static Hosting source handoff
---

# Monitoring closeout → universal static Hosting handoff (2026-11-10)

## Product decision

PocketHost is a generic owner-operated Android/Termux hosting product, **not an
IleStoi or PhotoMap management frontend**. Both existing deployments remain
external observations unless a future separately approved migration provides
an exact PocketHost ownership record. Never restart, adopt, rebind, stop,
move, or change either site as part of this UI work.

## Monitoring closeout candidate

- Host adapter reads a bounded, partial /proc process inventory (at most 96).
  Names come **only** from the short validated /proc/PID/status `Name:` field;
  inaccessible, unsafe or unsupported names are **null / Unknown**. No argv,
  command line, paths or executable ownership inference.
- Monitoring displays process name, PID, observed RSS and unverified/self
  identity; details disclose PPID, start ticks and **lifetime** CPU ticks.
  No current per-process CPU % is claimed; rows are read-only.
- The generic `/api/v1/observability` endpoint currently reports
  `diagnostics.state: unavailable` and `events: []`. The large empty card
  is collapsed to a clear future-source message with a link to
  **Logs & Diagnostics**. Do not silently substitute the Dashboard timeline
  or PhotoMap TEST logs.
- The existing PhotoMap TEST endpoint
  `/api/v1/managed-photomap/events` remains a separate compatibility-only
  read path; the generic event stream is **not yet implemented**.
- These are source changes pending exact-SHA Samsung testing and live owner
  visual acceptance; no release PASS is implied by this handoff.

## Static Hosting: existing reusable base (source audit)

- `apps/admin/src/app/sites/page.tsx` already uses **generic**
  `/api/v1/sites`: create a site, publish a ZIP/folder, start/stop/restart,
  read health/logs/assets, inspect immutable releases and restore/rollback.
- `src/modules/host/site-fleet-host.ts` uses explicit `site-<uuid>`
  ownership markers, fixed bound of eight sites and a separate loopback
  port pool. It checks process identity and refuses unsafe/unknown owners.
  Those site-local immutable release and activity records are suitable
  starting points for **site-specific** hosting events.
- `src/modules/host/site-fleet-server.mjs` serves only verified owned
  releases on loopback. The LAN gateway remains separate.
- `apps/admin/vite.config.ts` keeps generic static-site API
  `ownedSiteFleetApi()` distinct from `managedPhotoMapApi()`, the legacy
  `ownedDemoApi()`, and other runtime handlers.
- `src/modules/host/observed-service-catalog.ts` still contains
  fixed legacy external runit IDs and labels, including IleStoi-specific
  names. They belong to **observation compatibility**, never to the
  user-created site inventory or ownership registry. Replacing these
  globally before testing the generic alternative would break existing
  service observations.

## Next work in Hosting → Websites

1. Run read-only browser/API inventory of actual PocketHost-owned
   `/api/v1/sites` entries; distinguish empty list from endpoint disabled,
   and verify exact site/release identities, not assumptions.
2. Accept the existing static-site create → ZIP/folder publish → start →
   HTTP health → reload → version rollback path on an isolated disposable
   site, with no actions on the two pre-existing external products.
3. Define **generic** events keyed by `siteId`, `releaseId`, timestamp,
   source and reason (publish, failed publish, start, stop, readiness,
   rollback, restore); source from already owned operations only. No new
   global scanner, host daemon or foreign logfile discovery.
4. Keep host-level telemetry events separate from per-site hosting events.
   Only after this contract is validated should Monitoring consume
   a narrow read-only, bounded host diagnostic projection.
5. Review legacy external service catalog and PhotoMap compatibility
   endpoints for deprecation *after* generic functional parity and
   compatibility checks, not by deleting them during Monitoring closeout.

## Acceptance boundary

All compile/tests/checks run exclusively through the verified Samsung
Termux Local Agent on the exact `main` SHA. Protected external runit
services and projects remain unchanged. Device HTTP/browser visual QA is
separate from source tests. No hosting, domain, DNS, tunnel or service
migration is authorized by this document.
