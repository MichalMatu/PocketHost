---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-24
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

The server-side HTTP/API composition currently lives primarily in `apps/admin/vite.config.ts` with dedicated Node project, host snapshot, observability, connectivity and dashboard history adapters under `apps/admin/plugins`; it is **not** a browser module. Do not import `src/modules/host` into `apps/admin/src`. The `host` module contains most real implementations; the four former documentation-only placeholders have been consolidated into the module ownership document. See the [actual module inventory](MODULES.md) and [source checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md).

Static import/budget gates cover documented paths, but do not establish whole-application dependency or runtime process isolation. The historical documentation-only checkpoint did not establish runtime process isolation.

## Performance decisions (Sprint 3)

The A8 evidence in [roadmap](ROADMAP.md) supports the deployed snapshot batch (median 560.61 to 119.90 ms). Do not generalize this to all endpoints or idle CPU. Static shared-process profiling reduced summed RSS but does not preserve the current independent PID/cwd/argv ownership, stop/restart and gateway checks. Keep the per-site process model until a replacement proves independent lifecycle, crash containment, migration, rollback and equivalent releases/preview routing.

The isolated frontend-only Vite DEV/preview comparison showed lower RSS and cold asset latency for built assets. It excluded API plugins, browser rendering and live HMR/watch behavior; PSS was unavailable. A built UI switch is not approved by this evidence alone. Extract server-only HTTP adapters incrementally with existing route contracts, then qualify a common API composition independently of the development server. Prove same-origin routing, terminal HTTP/WebSocket proxy, ownership, process shutdown, telemetry/recovery, SPA fallback and deployment rollback before a built UI runtime replaces DEV. Continue using the existing runit supervisor and guarded DEV flow.

Retain synchronous ownership and release checks until isolated measurements identify a worthwhile change that preserves the exact semantics. Avoid speculative caches, extra supervisors or service changes. S4A host snapshot extraction is deployed. S4B extracts monitoring adapters with injection seams for isolated HTTP tests, without changing probe behavior, route order, cache duration or the existing collector lifecycle.
