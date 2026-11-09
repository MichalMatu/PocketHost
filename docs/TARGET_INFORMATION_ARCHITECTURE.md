---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Approved target navigation and provisional hosting/system responsibility model
---

# PocketHost — Target Navigation and Hosting Boundaries

## Decision and implementation status

On 2026-11-09 the owner approved the five-area menu as the target
information architecture. A later clarification on the same day makes the
**hosting isolation and application-first creation workflow mandatory**:

**PocketHost Hosting manages only projects explicitly created and configured
through the PocketHost application. It does not discover, auto-import, adopt,
or catalog already-running Termux websites and servers as hosting projects.**
IleStoi and PhotoMap are separate owner projects and are to be decoupled from
PocketHost source, API, monitoring labels, routing, and ordinary navigation.
Their external services, source data, tunnels and live processes must not be
touched during the decoupling.

The working H2 static-site lifecycle is the reusable base, not a feature to
replace. Its next evolution is a unified UI project wizard capable of
provisioning new backend-enabled applications. A legacy fixed PhotoMap
adapter is **not** the new generic backend host.

This file records the target. No current UI, running service, site data,
configuration, listener, external repository, or package installation was
changed merely by accepting this architecture decision.

## Approved target top-level navigation — revised modular direction

The earlier five-area menu was accepted as an intermediate target.
The owner's later 2026-11-09 decision supersedes its grouping:
**PocketHost is a modular platform; Hosting orchestrates modules.**

| Area | Target entries |
| --- | --- |
| **Dashboard** | Cross-module health, service states, alerts |
| **Hosting** | Overview; Projects; Deployments; Domains & Routing; Storage & Backups; Logs |
| **Modules** | Node.js; Python / PRoot; SSH; Cloudflare; Databases (future) |
| **Termux / System** | Monitoring; Processes & Services; Packages; File Manager; Terminal; System Backups |
| **Android & Shizuku** | Applications; CPU & Processes; Permissions; Services; Advanced Shell; Hardware |
| **Automation** | Agents; Tasks; API |
| **Platform** | PocketHost Network Access; Diagnostics; Settings; Appearance |

**Modules are independently configurable and reusable**, including
installation/update checks, module-specific configuration, runtime
status and supervision where applicable. Hosting creates and manages
projects by using these public module capabilities; it does not own a
second Node installer, SSH key manager or `cloudflared` controller.
SSH and Cloudflare have their own visible module pages, while
Cloudflare's shared Termux process is supervised only once.

This is **target architecture, not current UI implementation**.
Existing source still has an older navigation model. For prioritized
development and migration stages see [Roadmap](ROADMAP.md).

The upstream example pages, historical demo and test project should not be
first-class everyday navigation. Preserve their source and routes until
migration/compatibility decisions have been tested.

## Existing implementation — historical inventory, not the target product

The following describes code that exists today and must be retired, adapted,
or retained. This is **not** a requirement to detect or import the named
projects in future hosting.

| Existing object | Current PocketHost code / historical evidence | Target |
| --- | --- | --- |
| IleStoi / `wreckscanner` | Named read-only entry in `src/modules/host/host-snapshot.ts` | Remove its explicit product integration, label and special-case catalog entry; preserve the separate live Termux service |
| PhotoMap TEST / `photomap-test` | Separate, historically stopped Samsung import, read-only `/managed-projects` endpoint and dedicated PRoot runtime candidate | Remove dedicated PocketHost product integration and runtime adapter from active application architecture; do not launch/modify original or staged sources or data |
| PhotoMap production | Separate Raspberry Pi deployment in previous checkpoints | Entirely out of PocketHost scope |
| H2 static site fleet | `SiteFleetHost`, user-created ZIP/folder sites, owned local HTTP server, releases and rollback | **Keep and generalize** as the static runtime adapter |
| P3 `pockethost-demo` | Older separate test server and fixed two-version deployment API | Retire redundant navigation/API carefully; preserve files and running process until exact ownership and migration are reviewed |
| `cloudflared` | Named monitored Termux runit service | Remove app-specific Cloudflare assumptions; system-level tool status may be shown generically, with routing configured only by explicit user action |

The 2026-11-06 Samsung records confirm a **stopped PhotoMap TEST import**;
they do not establish its real-time state today. Decoupling is about removing
PocketHost coupling, not uninstalling or disrupting other projects.

Old source evidence: `src/modules/host/host-snapshot.ts`,
`src/modules/host/managed-photomap-host.ts`,
`src/modules/host/photomap-runtime-host.ts`,
`src/modules/runtime/photomap-runtime.ts`,
`apps/admin/src/app/managed-projects/page.tsx`,
`apps/admin/src/app/deployments/page.tsx`,
`apps/admin/vite.config.ts`, and
`docs/checkpoints/2026-11-06-photomap-runit-autorestart-regression.md`.

## Responsibility boundaries — system versus application

**Termux — System** owns host-level operations: packages and toolchains,
generic OS/runit service administration, processes, file browsing, terminal,
host metrics and system-wide backups. It does **not** discover or classify
existing Termux sites, scan ports to fill a hosting catalog, or synthesize
hosting project records from OS processes. Ordinary OS process lists may
reflect all visible processes without attaching a PocketHost project identity.

**Hosting** owns only app-created projects and their project-scoped
releases, runtime, dependencies, ports, health, storage, logs, backups, and
routing. A backend is not an uncontrolled shell command: it is a
user-provisioned runtime with explicit identity and lifecycle.

**Cloudflare:** The global `cloudflared` binary/process belongs to
Termux/System. Hosting > Domains & Routing owns only the per-project route
configuration that the user sets up through PocketHost. A site may reference
a shared tunnel, but does not gain authority to restart or reconfigure
existing external tunnel routes by that reference. No automatic import of
pre-existing tunnel mappings.

**Packages:** System > Packages manages global Termux software. Hosting >
Projects > Dependencies handles explicitly provisioned application-local
packages, e.g. npm lockfile install, Python venv, or a scoped PRoot runtime.
Do not couple an app update to an unreviewed global `pkg upgrade`.

**Backups:** Termux > System Backups controls host-level backups; Hosting >
Storage & Backups controls a specific PocketHost project's source, uploads,
database, runtime data and tested recovery. Static release history is not a
substitute for independent backups.

**Logs:** System shows generic process/service logs; Hosting shows only
PocketHost-created project logs; Platform > Diagnostics covers failures and
events of PocketHost itself. Do not hard-wire PhotoMap or IleStoi logs into
PocketHost observability.

**Android & Shizuku** is a separate Android device-management plane.
**Platform > Network Access** configures the PocketHost admin transport,
not a public project domain.

The present hard-coded external-service denylist and fixed observation list
are transitional code couplings. Move control authority to **positive,
verified PocketHost ownership/registration**. Keep the existing fail-closed
guards until the new default-deny policy is tested; do not weaken service
protection during removal of old project names.

## App-created project model (not yet implemented)

Only explicit **Create Project** operations produce a Hosting catalog entry.
Do not add an import-existing-running-service or scan-ports feature.

Each project should have:
- `type`: static website, frontend + backend application, backend service,
  or a future explicitly supported runtime type;
- `source`: ZIP/folder or an owner-chosen repository/target;
- `components`: frontend, backend and optionally worker/process entries;
- `runtime`: selected static/Node/Python/PRoot driver, separate local
  dependencies, build settings, launch definition, environment references;
- `ownership`: verified PocketHost instance identity, not a PID/port claim;
- `releases`: staged version, active version, rollback capabilities;
- `network`: owned local ports and explicit project domain/route mappings;
- `storage`: immutable releases and separately managed writable DB/uploads;
- `capabilities`: actual runtime/health/logs/backup/restore availability.

Recommended **Create Project** flow:
1. Name the project and choose Static Website, Web App (Frontend + Backend),
   or Backend/API.
2. Supply source (ZIP/folder initially; optional repository later).
3. Detect the supplied *project structure* only within this explicit source,
   or ask the user to select frontend/backend directories and framework.
   Do not inspect unrelated Termux directories or existing live servers.
4. Choose the supported runtime driver and app-local dependencies/build
   recipe, plus local endpoints and health path.
5. Configure project-specific secrets references, persistent data,
   backups and restart policy; preview the exact resource changes.
6. Stage and test the project's own deployment before Start/Publish.
7. Optionally configure its domain/tunnel route, only for explicitly
   user-approved routes. Show health, logs, deployments and rollback in
   this one project view.

An existing server may still run independently on Termux. If the owner wants
that application managed by PocketHost later, it should be **deployed as
a new, explicitly configured PocketHost project with a distinct owned runtime**
through the same wizard, rather than adopting the existing process.

## Migration decision — existing Termux workloads become app-created services

Owner clarification (2026-11-09): IleStoi and Local Agent are **future
migration candidates**, not permanent forbidden workloads. PocketHost must
**not discover/adopt** existing running processes, but the owner intends to
remove their separate Termux service registrations **after PocketHost is
independently accepted**, and recreate them through PocketHost's explicit
Create Project / Create Managed Service workflow.

The distinction is between (a) prohibited automatic discovery/adoption
and (b) explicitly **provisioning a new owned installation** from source,
approved configuration, dependencies and preserved data. A new PocketHost
service must have one owner and no competing production runit entry. The
current services must not be removed until the replacement and rollback are
both proven. Even after migration, hosted programs still physically execute
inside Termux; what changes is the **configuration/lifecycle owner**, not
Android's runtime environment.

### Verified existing source contracts, not current live state

| Component | Existing independent mechanism | Required preservation |
| --- | --- | --- |
| IleStoi / `wreckscanner` | `deploy/termux/wreckscanner.run` uses project-specific Python `.venv`, `server.py`, standard Termux `runit`, local port 8001 | Project-managed Python environment, explicitly selected persistent SQLite/media, exact health checks; never run two writers against production data |
| IleStoi backup | `wreckscanner-backup.run` schedules Restic approximately daily with `flock`, hourly retry and weekly retention maintenance | Locking, backup credentials outside UI, proven restore and retention (7 daily, 8 weekly, 6 monthly) |
| Cloudflare | `cloudflared.run` uses private `~/.cloudflared/config.yml` and Termux `runit` | One shared tunnel service, private credentials and explicit owned routing; do not duplicate or change the currently active tunnel by default |
| IleStoi tunnel healthwatch | `ilestoi-healthwatch.py` tests backend ready 200, public 502/503/504/520-524/530 and outbound TCP; three failing checks at 180-second intervals; 30-minute restart cooldown; honors `down` marker | Express this as a reusable **service-specific recovery policy**, not a blanket network restart rule. Never restart the backend for only a tunnel failure |
| Local Agent | Independent Termux:Boot `90-local-agent`, private `runsvdir`, app-private installation, Git task/result spools and `EMERGENCY_STOP` | Preserve exact private installation identity, durable claims/results, no-replay UNKNOWN semantics and out-of-band operator rollback; never start two consumers of one task namespace |
| PocketHost panel | `pockethost-panel` and `pockethost-panel-watch` under standard Termux runit; 12-second HTTP health probes, three failures, 120-second cooldown and initial 50-second grace | Reuse proven runit supervision as the underlying adapter, not a second OS process manager |

Sources: `MichalMatu/ilestoi/deploy/termux/*`,
`MichalMatu/ilestoi/docs/TERMUX.md`,
`MichalMatu/local-agent/platforms/android/local-agent/README.md`,
`MichalMatu/local-agent/platforms/android/local-agent/termux_agent/*`,
`MichalMatu/local-agent/deploy/termux/*`, and PocketHost
`docs/adr/0014-termux-panel-supervision.md`.

The IleStoi docs record a **2026-11-08 Cloudflare outage caused by a stale
`down` marker and an invalid `--token-file` runner**. Live service entrypoint
must be verified against the checked-in runner and config before any staged
migration. The historical Local Agent's own Termux:Boot and independent
`runsvdir` are deliberate safety boundaries, not duplicate PocketHost code.

### Proposed reusable service control plane

A single **PocketHost-managed Service Registry** for *explicitly provisioned*
services should be the authoritative UI/API for status, last health results,
Start/Stop/Restart/Enable, autostart, restart policy, dependency checks,
backup policy, events and logs. Each service record references exactly one
project or shared infrastructure component.

Implement as separate layers:
1. Application-supplied source/manifest parser and an immutable reviewed
   **install plan**; detect `package.json` + lockfiles, `pyproject.toml`,
   `requirements*.txt` and explicit service manifests; never scan
   unrelated existing Termux projects.
2. A `DependencyResolver` comparing required versions/constraints with
   actual capabilities: `installed`, `missing`, `incompatible`,
   `update-available`, or `unknown` (network/cache uncertainty).
   Expose **Check / Install / Update** only for explicit per-project plans
   with preflight, user approval, snapshots and post-install verification.
   Separate shared Termux `pkg` changes from project-local `npm ci`/
   Python venv/PRoot dependencies; no implicit global upgrade.
3. A `SupervisorAdapter` using the installed Termux **runit**, plus
   exact-owner markers and bounded process identity guards. Preserve
   existing accepted service scripts as templates or verified plugins;
   do not add another `runsvdir` for each PocketHost project.
4. A `HealthPolicyEngine` with typed liveness, readiness, optional public
   reachability, failure threshold, interval, startup grace, cooldown,
   dependencies, explicit disabled/maintenance state and escalation.
   Policy may request a restart only of its registered owned service,
   and records reason, last action and suppressed attempts.
5. A central view **Managed Services & Reliability** (with per-project
   detailed screens) showing owner, service, auto-start, health,
   dependency status and recovery history. This is one management plane,
   not separate scripts issuing competing restarts.

Do not turn one incident-specific healthwatch into a global default.
IleStoi's tunnel policy and PocketHost's panel policy are intentionally
different, and Local Agent's task-integrity fences cannot be replaced by
an HTTP process health check.

### Cutover stages — no active service removal yet

1. **Read-only host preflight**: verify the active boot scripts, both
   `runsvdir` trees, exact service run scripts/down markers, localhost
   readiness, cloudflared ingress validity, source hashes and durable
   Local Agent task state. Never print credentials.
2. **Source-based staging**: Create an IleStoi project and Local Agent
   service through PocketHost UI using approved repo manifests. Install
   app-specific dependencies in new owned directories; perform tests with
   disposable app data. Keep the original services running unchanged.
3. **Controlled acceptance**: validate health, rollback, backup restore,
   restart policy and no duplicate workers/processes; do not connect a
   staging tunnel to production hostname or reuse live SQLite for a
   simultaneous second writer.
4. **One-at-a-time cutover**: external independent SSH/USB operator
   controls the transition, atomically disables old service autostart
   before enabling one replacement; validates end-to-end routing, backups
   and restart after cutover, and retains reversible prior definitions.
5. **Local Agent LAST**: Do not allow the Agent to stop/migrate its own
   supervisor through a queued Agent command. Preserve the private
   `EMERGENCY_STOP`, installed identity, claims/results, keys and transport;
   use an independent operator channel and prove fresh real Git
   task/result publication after switch. No duplicate polling under the
   same installation ID.
6. **Only after PASS**: retire the old corresponding Termux runit
   registrations/boot hooks, not Termux itself, global packages,
   original app code, backup archives or other services.

No production service should be stopped, reconfigured, imported by
discovery or removed just because this target architecture has been recorded.

## Hosting today versus target backend hosting

The working H2 fleet accepts a bounded ZIP or browser-selected folder
containing static HTML/CSS/JS/assets. It has verified owner markers, a
dedicated loopback HTTP process, immutable releases, Start/Stop/Restart,
health, preview and rollback. Keep these strengths and user data intact.

Current limits: 8 sites, 16 releases per site, 8 MiB unpacked, port range
starting at 19080, and the existing LAN preview origin 18879 with
`/h2/<site-id>/`. They are implementation constraints, **not** the future
generic application format.

Frontend + backend is not a static ZIP publish. One **PocketHost project**
should be able to own multiple isolated components (frontend build, backend
server, optional worker) with one project identity and coordinated releases.
Add a runtime driver for a newly created Node app, then Python/PRoot after
device testing. Separate source, immutable release, mutable database/uploads,
dependency locks and credentials. Preserve exact owner/PID/start-ticks/argv
guards and deny changes to unrelated Termux services.

The existing `src/modules/runtime/managed-runtime.ts` generic ownership
contract may be reused after auditing it; the current PhotoMap-specific
adapter must **not** remain as a dependency of the new generic engine.
Health-checked staged publishing, project-scoped logs, recovery-tested
data backup and optional per-project domain routing are additional features,
not features already provided by the current static fleet.

## Couplings to remove while preserving working hosting

1. Remove named IleStoi/PhotoMap sites from PocketHost app navigation,
   hosting inventory, hard-coded read-only service cards and product API.
   Do **not** modify their separate Termux/runit instances.
2. Retire the dedicated PhotoMap UI endpoint, fixed import catalog,
   unaccepted launcher adapter and PhotoMap-specific diagnostics coupling
   after checking that no live PocketHost-owned process depends on them.
   Preserve imported files and test-stage manifests until separately
   authorized cleanup; do not remove the external original checkout.
3. Move `apps/admin/src/app/deployments/page.tsx` off the legacy P3
   `pockethost-demo` API and onto a project-based release history.
   Decommission its separate two-version UI/backend once compatible H2
   function is provided. Never delete an existing demo site blindly.
4. `apps/admin/src/app/termux/page.tsx` currently imports the H2 sites
   catalog into Files, Services and Backups. Move these project-specific
   panels to Hosting. Keep generic Termux tools in System.
5. `apps/admin/vite.config.ts` currently composes unrelated modules
   (PhotoMap, demo, static sites, Termux, Shizuku, monitoring, LAN).
   Split composition by explicit domain. Reuse safe guards; do not
   introduce a competing process supervisor.
6. `src/modules/host/host-snapshot.ts` hard-codes `wreckscanner`,
   `ilestoi-healthwatch`, Cloudflare and other services. Replace the
   named service catalog with generic OS metrics/runit information only.
   Retain a **positive ownership allowlist** for mutations, and deny by
   default until safely migrated.
7. Decouple `src/modules/host/lan-gateway.mjs` from legacy P3 and H2
   layout without changing current live links or tunnel routes prematurely.

## Recommended staged migration (proposal, not authorization)

1. Preserve current working H2 static hosting and exact owned process
   identities. Establish a baseline of currently owned H2/P3 resources.
2. Clean the product menu and dedicated IleStoi/PhotoMap integrations,
   keeping unrelated device services and source data untouched.
3. Add an app-created **unified project registry** and retire redundant
   legacy demo/PhotoMap API consumers behind compatibility checks.
4. Make H2 static fleet the first driver in one **Create Project** flow,
   preserving existing revisions, addresses and start/stop behavior.
5. Separate HTTP API modules and host adapters; remove global Termux
   operations from application-level controls without weakening guards.
6. Add an isolated newly created Node backend project driver and a
   complete local frontend + backend flow. Verify launch, restart,
   rollback, logs, DB backups and port collision on a disposable app.
7. Add Python/PRoot support and user-approved per-project routing later,
   after native verification and recovery tests.

No automatic discovery, importing or adoption of existing external servers
is part of this plan.

## Still to verify before modifying source or running services

- The exact H2 sites and P3 demo that PocketHost **owns** so they can be
  preserved when consolidating the hosting UI; this is not a request to
  detect or catalog any external Termux servers.
- Whether the existing installed PocketHost panel still uses the historical
  demo/PhotoMap API routes before safely removing them.
- Which frontend/backend runtimes the owner wants to support first.
- The minimal app-first wizard UX and server configuration/health contract.
- Whether any changes to shared tunnel/domain mapping are explicitly
  authorized; **existing Cloudflare routes remain unchanged by default**.

This document records a **source-only architecture analysis**. No live
device operation, process migration, package change, or deployment is implied.
