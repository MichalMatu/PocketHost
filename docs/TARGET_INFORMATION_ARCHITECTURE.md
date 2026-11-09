---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Approved target navigation and provisional hosting/system responsibility model
---

# PocketHost — Target Navigation and Hosting Boundaries

## Decision and implementation status

The owner selected the five-area navigation below as the **target information
architecture for the current DEV product** on 2026-11-09. This supersedes the
earlier top-level grouping for planning purposes. It does **not** mean the
existing UI routes or backend have been changed. The hosting-specific taxonomy
and implementation sequence below are analysis and proposals to refine in
further discussion, not approval to adopt, stop, reconfigure, deploy or expose
any existing service.

Keep PocketHost a Termux/Android management platform with hosting as its own
bounded capability. Separate an observed external service from an imported,
stopped project and a PocketHost-owned runnable application.

## Approved target top-level navigation

| Area | Target entries |
| --- | --- |
| **Termux — System** | Dashboard; Monitoring; Processes & Services; Packages; File Manager; Terminal; System Backups |
| **Hosting** | Overview; Projects; Deployments; Domains & Routing; Storage & Backups; Logs |
| **Android & Shizuku** | Applications; CPU & Processes; Permissions; Services; Advanced Shell; Hardware |
| **Automation** | Agents; Tasks; API |
| **Platform** | Network Access; Diagnostics; Settings; Appearance |

The labels and placement are accepted **as a target**, not a request to
implement them immediately. Existing source still has the older
System/Hosting/Automation/Platform/Examples navigation.

The upstream example pages, historical demo and test project should not be
first-class everyday navigation. Preserve their source and routes until
migration/compatibility decisions have been tested.

## Current project and server inventory — distinguish scope and authority

| Object | What it is | PocketHost authority in current code / evidence |
| --- | --- | --- |
| IleStoi.pl | Existing **external Termux/runit service** under the monitored name `wreckscanner` | Read-only service status; PocketHost must not infer authority to deploy, stop or change it |
| PhotoMap production | Independently operated production application, documented on Raspberry Pi in the 2026-11-06 checkpoints | **Not hosted, adopted or modified** by the Samsung PocketHost import |
| PhotoMap TEST on Samsung | Independent managed **stopped import** `photomap-test` with source, SQLite, media, Debian/PRoot staging and fixed port 8010 | Read-only `/managed-projects` catalog; source runtime adapter exists but no accepted Start/Stop, health or restore; no autostart |
| User-created static sites | H2 `SiteFleetHost` fleet, created explicitly through ZIP/folder upload | PocketHost-owned static-only instances with per-site localhost server, release history, rollback and lifecycle |
| PocketHost Demo | Legacy P3 `pockethost-demo`, exactly two built-in HTML versions | Separate PocketHost-owned demonstration runtime and API; not the same thing as the H2 fleet |
| Cloudflare tunnel | Existing `cloudflared` external Termux/runit service | Status monitored; no general-purpose tunnel/domain provisioning or ownership transferred to PocketHost |

Historical real-device evidence establishes a **stopped PhotoMap TEST import**,
not the current minute-by-minute state of the Samsung or Raspberry Pi. Check a
fresh Local Agent read-only snapshot before reporting current liveness.

Relevant sources:
- `src/modules/host/host-snapshot.ts` (fixed monitored external services).
- `src/modules/host/site-fleet-host.ts` and `site-fleet-server.mjs` (H2 static).
- `src/modules/host/owned-site-host.ts` (legacy P3 demo).
- `src/modules/host/managed-photomap-host.ts` (fixed PhotoMap import).
- `src/modules/host/photomap-runtime-host.ts` (unaccepted runtime candidate).
- `docs/checkpoints/2026-11-06-photomap-runit-autorestart-regression.md`.
- `docs/checkpoints/2026-11-06-p4-managed-photomap-catalog.md`.

## Responsibility boundaries — one resource, different views

**Termux — System** owns host-wide software, shared Termux package manager
operations, processes, runit services, files, hardware-accessible observations
and full-host backups. It may **observe** externally owned servers and
`cloudflared` without being authorized to manage them. The host-wide package
inventory and package changes belong here.

**Hosting** owns application identities, deployment sources, versions,
application-specific runtime/dependency environments, site content/data,
project health/logs/backups and public-facing domain/routing **configuration**.
Project-specific dependencies (Node lockfiles, Python venv/requirements,
isolated PRoot profiles) belong to each project's runtime view, not to the
global Termux package manager. A project may *reference* a shared resource
without taking over its lifecycle.

**Cloudflare split:** `cloudflared` is an underlying Termux service with
status shown under System > Processes & Services. Hosting > Domains & Routing
may later show the domains, routes, origins and tunnel association used by
each project. Platform > Network Access owns the **PocketHost admin-panel**
LAN binding and access, not website routing. Do not automatically edit the
existing tunnel configuration or reveal credentials. Existing tunnel
membership and mappings are not established by the source catalog.

**Backups split:** Termux > System Backups covers host/Termux state and shared
workspaces. Hosting > Storage & Backups covers **one application's** release
assets, environment, databases, uploads and recovery points. Immutable static
releases are not equivalent to an independent recoverable backup.

**Logs split:** Hosting > Logs is scoped to a selected application/deployment;
Platform > Diagnostics contains PocketHost's own control-plane failures and
audit/transport evidence. A general process log can also appear read-only
under Termux without adopting that service.

**Android & Shizuku** concerns Android-wide apps and permissions, not Termux
package management or a hosted project's Python/Node dependencies.

## Proposed single hosting project catalog (not yet implemented)

A future record should distinguish at minimum:
- `kind`: static-site, frontend-plus-backend, backend-service, imported
  application, or legacy demonstration.
- `ownership`: external-observed, imported-stopped, or PocketHost-managed.
- `capabilities`: independently confirmed inspect, start, stop, deploy,
  logs, health, dependencies, backup, restore and routing.
- `runtime`: static HTTP, Node.js, Python/PRoot, or a future adapter;
  exact executable/build/launch parameters and source release.
- `network`: internal listen address/port, public domain/tunnel association
  and whether PocketHost has authority to configure it.
- `data`: immutable source/releases versus mutable uploads, database,
  secrets and snapshot/restore status.

**Discovery never confers management rights.** For any existing service,
import/registration requires explicit owner intent, verified executable,
process ancestry, working directory, port, source and data boundaries and a
recovery plan. PhotoMap TEST must not automatically inherit production
PhotoMap rights or reuse its existing checkout/database.

## Hosting today versus target backend hosting

Today H2 supports **static** HTML/CSS/JS/assets uploaded as a bounded ZIP or
browser-selected folder. It starts its own loopback Node HTTP server and
offers controlled release/rollback. Current limits include 8 sites, 16
releases per site, 8 MiB unpacked and a dedicated port range starting 19080.
The GET/HEAD-only LAN site gateway uses port 18879 and `/h2/<site-id>/`.
These are implementation limits, not desired universal product boundaries.

A frontend **plus backend** needs a different explicitly managed application
runtime, not an HTML ZIP served by the H2 static server:
1. Register a source repository/archive and identify frontend, backend and
   app-owned writable data separately.
2. Select a runtime adapter, e.g. Node.js app or Python app in an isolated
   environment. Build/install app-local dependencies against verified locks.
3. Define explicit owned start/stop/health, loopback binding, app logs,
   resource limits and a process identity that prevents accidental adoption.
4. Stage a release and test it without changing the active app; switch a
   verified reverse-proxy route only after health succeeds.
5. Preserve and validate independent database/upload backup and recovery,
   including migrations; app source rollback alone does not restore data.
6. Optionally associate a domain or existing Cloudflare tunnel **after**
   route ownership and safe configuration changes are separately approved.

The generic `src/modules/runtime/managed-runtime.ts` and registry already
provide part of the ownership policy but they are **not** a working
general-purpose Node/Python host. The existing PhotoMap-specific PRoot
implementation is not a reusable production backend engine yet.

## Couplings to untangle in future implementation

1. `apps/admin/vite.config.ts` aggregates HTTP handlers for static hosting,
   legacy demo, PhotoMap TEST, observability, Termux, network and Shizuku.
   Extract typed domain-specific API composition rather than creating new
   parallel process supervisors.
2. `apps/admin/src/app/deployments/page.tsx` displays **only the legacy
   demo** instead of general project releases; the H2 site page already has
   separate release history.
3. `apps/admin/src/app/managed-projects/page.tsx` is specifically PhotoMap
   TEST plus P3 demo. Future Projects must be a capability-based catalog,
   not a hard-coded project list.
4. `apps/admin/src/app/termux/page.tsx` pulls H2 sites into system Files,
   Services and Backups. Move project details into Hosting and keep host
   resources in System, using references instead of duplicated controllers.
5. `apps/admin/vite.config.ts` observability currently reads a
   PhotoMap-specific runtime log. Diagnostics should consume a generic
   event interface, not reach into one application adapter.
6. `src/modules/host/host-snapshot.ts` hard-codes six historical services.
   Separate generic discovery from protected identities; **never weaken the
   existing external-service protection** merely to make discovery generic.
7. `src/modules/host/lan-gateway.mjs` ties the legacy demo origin and H2
   project preview routes to fixed gateway ports. Keep current URLs stable
   while designing per-project virtual hosts and routing.

## Recommended staged migration (proposal, not authorization)

1. Make the cross-product inventory and statuses truthful, including
   explicit external/managed/imported and static/backend capability badges.
2. Implement the **approved menu taxonomy** without changing live host
   ownership, data, tunnel, service or listener configuration.
3. Introduce one shared project catalog and scoped deployment history.
   Keep legacy routes as compatibility redirects/adapters during migration.
4. Extract hosting API from Vite composition and reuse exact-owner lifecycle
   guards; separate host resources from application resources.
5. First fully qualify the existing static adapter under the new model.
   Then implement **one** isolated backend runtime adapter using disposable
   data; expand to other stacks only after native verification.
6. Add domain/tunnel routing and project-level data recovery with independent
   approval and rollback. Do not reuse the existing external tunnel by
   assumption.

## Still to verify on the device / with the owner

- Actual **current** IleStoi server stack, start command, data location,
  listener, service ownership and whether it should remain read-only.
- Whether any PhotoMap process is currently running anywhere on Samsung;
  2026-11-06 physical evidence reported the **TEST import stopped**.
  Production PhotoMap's Raspberry Pi state is a separate host question.
- Which Cloudflare tunnel routes to which origins today; do not infer this
  from a running `cloudflared` process.
- Desired frontend/backend stacks, databases and whether one managed app
  or multiple independently routed services should form one project.
- Whether any user-created static H2 pages are production workloads before
  renaming or migrating their persisted schema.

This document records a **source-only architecture analysis**. No live
device operation, process migration, package change, or deployment is implied.
