---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-25
purpose: Minimal component boundaries
---

# Architecture

Admin UI (`apps/admin`) → typed `src/shared` contracts → `src/modules/host` for all Termux filesystem/process/OS operations. Companion/Shizuku is an optional native Android-loopback bridge; browser has no Binder privilege.

Module, managed service and user-created Hosting project identities are separate. Discovery does not grant ownership. H2 static and Node.js Hosting have independent ports, processes, files and releases; reuse infrastructure interfaces only.

## Host coordinator contract

PocketHost is the host-level **desired-state coordinator** for every service it
creates or explicitly enrolls. It owns the registry, installation and updates,
autostart policy, health/readiness observations, bounded restart/recovery
policy, logs, and rollback evidence. Official Termux `runit` performs the
actual process supervision; PocketHost must not create a competing scheduler
or infer ownership from a port, process name or discovery result.

SSH and Git are first-class host capabilities for managed access and project
deployments, not an alternative host execution engine. Existing SSH and Local
Agent infrastructure is **observed/protected by default**; control transfer
requires an explicit, independently attested ownership/enrollment record and
a recoverable access path. Local Agent remains a separate trusted task
transport even when the PocketHost panel is unavailable.

The A8 bootstrap established owned panel/watch services, global Termux runit
and a Termux:Boot supervisor hook. Boot-time autostart has not yet been
physically reboot-qualified. Subsequent M2-M5 work must use the common
registry/health/lifecycle contract across static and Node Hosting, without
merging their release and storage boundaries.

## Project-agnostic product boundary (owner-approved)

PocketHost is a **generic Termux and Hosting management product**. No hosted
customer/application name, domain, process name, filesystem root, special
health endpoint, launch script or per-project diagnostics may be hardcoded
into active PocketHost UI, API, default inventory or platform configuration.
Projects enter only via user-created declarations / registries and explicit
ownership, not application-specific modules. Historical checkpoints/ADRs are
kept as history and do not ship as runtime integration.

A private-LAN **no-login** admin UI is intentional for the owner's trusted
home network. Network Access in the panel must control enable/disable,
eligible private interface/address, current LAN URL and boot behaviour.
The admin must never be exposed to the WAN, port-forwarding, arbitrary
interfaces or a public reverse proxy by default. No password does **not**
make LAN peers trusted: maintain strict local-only management action gates,
origin/CSRF protections, host allowlists, scope confirmation and recoverable
loopback access. Do not silently weaken existing mutation restrictions.

The panel owns all supported **settings surfaces**, not hidden host-specific
scripts or hardcoded environment values: per-service desired/autostart state,
restart budgets, readiness targets, health policies, logs and recovery; global
runit/Termux:Boot configuration; SSH enablement, key-based access and listener
policy; Git and GitHub repository association and secure credentials. Any
secret material stays out of UI responses and task output. SSH/Local Agent
remain independently protected until a separate, reversible owner action
explicitly enrolls them. Persist changes as validated desired state with
readback; `runit` is the sole process supervisor, not an extra scheduler.

The 14 November 2026 genericization removed named hosted-app pages,
diagnostics and endpoints, plus the fixed external-service catalog. Live
service observation now uses the device's runit inventory. This is _not_
a claim that LAN boot acceptance, per-service health editing, SSH/GitHub
configuration or external-service enrollment are complete.

## Services navigation and UI ownership

`/services` is a links-only overview. Separate routes and components must own
Runit lifecycle/registration, service autostart, Node/static Hosting inventory,
on-demand readiness/health, independent Local Agent, SSH and optional system
services. A page only fetches its own data; the overview does not fan out
across all service APIs. In-panel settings belong next to their owning area,
not in a monolithic Services form. External service discovery alone remains
read-only and never confers authority. Runit boot enablement is distinct
from Android Termux:Boot qualification, and readiness is distinct from PID
liveness. Do not introduce extra periodic health workers or fake status
switches for absent settings.

## Current implementation boundaries and debt

`apps/admin/vite.config.ts` now contains composition only, with dedicated Node project, host snapshot, observability, connectivity, dashboard history, Termux tools, Shizuku, static hosting, network and Termux admin adapters under `apps/admin/plugins`; it is **not** a browser module. Do not import `src/modules/host` into `apps/admin/src`. The `host` module contains most real implementations; the four former documentation-only placeholders have been consolidated into the module ownership document. See the [actual module inventory](MODULES.md) and [source checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md).

S4E3 strengthens the browser import/budget gate using the existing TypeScript parser: static imports, re-exports, literal dynamic imports, import types and CommonJS require are inspected; computed module imports are refused. Server adapters remain outside browser scope. This source check does not establish full transitive dependency or runtime process isolation. The historical documentation-only checkpoint did not establish runtime process isolation.

## Performance decisions (Sprint 3)

The A8 evidence in [roadmap](ROADMAP.md) supports the deployed snapshot batch (median 560.61 to 119.90 ms). Do not generalize this to all endpoints or idle CPU. Static shared-process profiling reduced summed RSS but does not preserve the current independent PID/cwd/argv ownership, stop/restart and gateway checks. Keep the per-site process model until a replacement proves independent lifecycle, crash containment, migration, rollback and equivalent releases/preview routing.

The isolated frontend-only Vite DEV/preview comparison showed lower RSS and cold asset latency for built assets. It excluded API plugins, browser rendering and live HMR/watch behavior; PSS was unavailable. A built UI switch is not approved by this evidence alone. Extract server-only HTTP adapters incrementally with existing route contracts, then qualify a common API composition independently of the development server. Prove same-origin routing, terminal HTTP/WebSocket proxy, ownership, process shutdown, telemetry/recovery, SPA fallback and deployment rollback before a built UI runtime replaces DEV. Continue using the existing runit supervisor and guarded DEV flow.

Retain synchronous ownership and release checks until isolated measurements identify a worthwhile change that preserves the exact semantics. Avoid speculative caches, extra supervisors or service changes. S4A host snapshot extraction is deployed. S4B monitoring adapters are deployed. S4C Termux/Shizuku adapters are deployed. S4D hosting/LAN adapters are deployed. S4E1 split the remaining Termux admin adapter into a shared host context, read projections, typed action dispatch and one HTTP serialization/intent boundary. Vite remains the runtime composer; independent built UI/API equivalence still requires QA. S4E2 moves Node runit record validation, owned-file primitives and local probes into separate modules, and extracts Termux registry/archive I/O. Preserve public host facades and every ownership check.

## Traffic Analytics (Sprint 5)

`traffic-history.mjs` holds bounded aggregates; `traffic-store.mjs` owns validated per-project snapshots; `traffic-http.mjs` observes completed HTTP responses. Static collection uses its own server and Node collection uses the native HTTP diagnostics channel via its existing runit launch script. `traffic-runtime.ts` projects snapshots only after the hosting API verifies the project; PID/start ticks distinguish a current process from historical data. The browser uses a typed parser and opens/refetches the traffic panel on demand. No additional supervisor, dependency or background UI polling was added.

- GET `/api/v1/sites/:id/traffic?range=24h|7d` and `/api/v1/node-projects/:id/traffic?range=24h|7d`. Missing/unavailable snapshots are distinct from measured zero; stale (over 30 seconds) or historically attested RPS is unavailable.
- Counts include completed native HTTP responses, not aborted requests, WebSocket traffic or HTTP/2. Bytes are response payload, excluding headers/framing; Node readiness excluded, Static health and previews included. Paths omit query strings and fragments, but path segments may themselves contain identifiers. At most 32 approximate path counters per UTC hour, 120 characters per path, top ten lower-bound counts and explicit overflow.
- Each project has at most 168 hourly buckets and 60 second counters. The 24h/7d views prune the logical window; snapshots persist atomically with a coalesced 15-second write after traffic in the existing process. Idle or stopped snapshots are not physically rewritten on a timer; old buckets are pruned on read/next write. Abrupt process termination may lose an unflushed batch.
- Local storage under `.local/state/pockethost/traffic-v1`: maximum 24 project identities and 4 MiB per file, with at most a snapshot and temporary file per identity. Verified Static removal attempts to reclaim only its own analytics files; unsafe or failed cleanup is left intact. Capacity exhaustion or corrupt storage disables collection rather than blocking the hosted response. This is bounded storage, not strict wall-clock physical erasure; no independent timed purge.
- Existing running applications adopt instrumentation on their normal next start. Do not force customer application restarts for analytics. Node applications share the Termux UID; no isolation claim.

Final scoped QA, benchmark and A8 deploy/postflight receipts are in [quality gates](QUALITY_GATES.md).

## SQLite Studio (Sprint 6)

The Projects data panel opens SQLite Studio explicitly, using the existing Node owner session. `node-sqlite-api.ts` handles only GET `/api/v1/node-projects/:id/sqlite` with optional opaque `db`, `table` and `page` parameters. `node-sqlite-studio.ts` uses `NodeProjectDataScope` to discover only the selected project's private `db` category; `src/shared/node-sqlite-studio.ts` validates scoped response identities and limits on both sides. No arbitrary SQL, export/import, file creation, database mutation or service stops.

One on-demand subprocess (`node-sqlite-reader.mjs`) uses native `node:sqlite`, read-only connections, query-only/trusted-schema settings and a restricted authorizer. The A8 runtime is Node 24.22.3 / SQLite 3.54.1; unsupported native capabilities fail closed. Bounds include 16 MiB per file, 128 tables, 24 columns, 20 rows per page, 50 pages, 64-byte text and 16-byte BLOB previews, 256 KiB response, 3-second subprocess timeout and 16 MiB SQLite heap limit. Each page is a distinct snapshot; views do not guarantee stable order. No full row count.

Active WAL reads require both existing WAL and SHM sidecars; SQLite can change SHM coordination bytes, but isolated tests preserve main/WAL bytes and file inventory. A clean WAL-mode database without sidecars is read immutable only after observed stopped runtime; otherwise it is offline-only. Rollback journals, invalid paths, identity changes, concurrent reader requests and unsupported schemas are handled explicitly. These are inspection semantics, not a backup consistency or untrusted-code isolation guarantee. See [quality evidence](QUALITY_GATES.md).

## Application Starters (Sprint 7)

Static creation retains the editable single-file HTML starter and adds an HTML/CSS option through the same one-step owned JSON import and stopped immutable-release readback. Switching the selected starter resets sample HTML; existing ZIP/folder import remains exclusive. No automatic start.

The browser-only Node JSON API starter shares the existing dependency-free manifest and lockfile and uses assigned PORT, loopback binding, readiness nonce and GET /api/status. Loading it requires confirmation and replaces the editor draft, clears old imported files and invalidates prior approvals/reviews. It does not stage, install, deploy or start anything; normal reviewed Node lifecycle remains authoritative. See [quality evidence](QUALITY_GATES.md) for isolated execution and rollback boundaries.
