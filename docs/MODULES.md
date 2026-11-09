---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Define current module boundaries and target modular platform contracts
---

# Module Boundaries

## Architecture rule

Every registered module has a matching
`src/modules/<name>/AGENTS.md` and
`docs/modules/<name>.md`. No feature module
imports another feature module's internals.
Use explicit contracts in `src/shared` and
a composition boundary. Only `host` executes
Termux process/filesystem operations. The UI
has no direct OS or shell access.

## Approved target: modules, managed services, Hosting

The 2026-11-09 [roadmap](ROADMAP.md) distinguishes three layers:

- **`ModuleRegistry`:** Node.js, Python/PRoot, SSH, Cloudflare and
  later databases, each exposing versioned capabilities, module UI
  and configuration. A module is **not** a project.
- **`ServiceRegistry`:** exactly one explicit lifecycle owner
  per runit service. The host adapter checks ownership; observation
  of a port/name/PID does not permit starting or stopping it.
- **`ProjectRegistry`:** only app-created Hosting projects, with
  versioned `components[]` referencing runtime modules, services,
  dependencies, network, secrets and releases.

Shared contracts include `DependencyPlan`, `ServiceLifecycle`,
`HealthPolicy`, `SecretRef` and `BackupPolicy`. Their concrete
execution remains behind the existing Termux `host` adapter.
The shared `SupervisorAdapter` delegates to runit, and the
health evaluator triggers bounded owner-specific recovery only.
Do **not** add an independent supervisor per module.

Start with a one-component **Node.js Hosting project at M3**,
then separate SSH/Cloudflare/Python integrations at M4 and
complete multi-component orchestration at M5. Reuse current
H2 static hosting and existing runit policies; no automatic
takeover of IleStoi or Local Agent. No new source module or
manifest is claimed to exist by this architecture decision.

## New power-user integration

`shizuku` owns Android companion session detection, real ADB/root-mode
capability negotiation and future user-directed Android controls.
The browser cannot call Android Binder itself; the companion will
provide a typed local bridge. The first source slice contains a
navigable control hub and a typed contract, **not** a connected bridge.
Scope aims for full available Android privileges rather than an
artificially read-only feature set. See [module definition](modules/shizuku.md)
and [ADR-0013](adr/0013-shizuku-power-user.md).

## Modules and owners

- `inventory`: read-only known services and ports.
- `host`: fixed Termux metrics, runit, process
  and resource probes with permission bounds.
- `runtime`: exact-owner guarded lifecycle and
  PRoot process identity policy.
- `packages`: package/version inventory;
  installations and upgrades disabled.
- `sites`: explicit PocketHost-owned site data.
- `config`: validated configuration.
- `diagnostics`: structured redacted event
  history and dry-run recovery information.
- `shizuku`: native Android power-user integration and real privilege negotiation.
- `observability`: source-candidate aggregation
  of admitted snapshots and bounded time series.
- `ai`: future scoped API, currently disabled.
- `ui` / `apps/admin`: typed dashboard views.
- `shared`: narrow contracts, not a service.

## O1 workstream mapping

Host Monitor and Process Inspector: `host`.
Runtime Diagnostics: `runtime` plus `diagnostics`.
Package Inventory: `packages`. Dashboard:
`apps/admin`. Normalization/retention:
`observability`. No second process manager.

Observation does not grant ownership.
External and unknown processes remain read-only.
A PID/name/port is not authorization to signal.
Unknown metrics and permission errors must be
shown explicitly. No module may silently add
a new public API, install packages or enable
automatic recovery.

[Observability specification](modules/observability.md)
and [ADR-0010](adr/0010-read-only-observability.md)
own the new boundary. Source implementation
needs device QA before being marked accepted.

## H2 accepted module composition

- `sites`: pure ZIP/folder validation, payload and
  path/resource limits; no host filesystem access.
- `host`: exact owner marker, static release storage,
  loopback process identity, lifecycle, read-only
  LAN preview admission and bounded resource probes.
- `apps/admin`: typed project creation, file import,
  deploy/rollback, process control, logs and health UI.
- `runtime`: existing P3 demo and generic registered
  service policy; PhotoMap remains disabled and
  external processes remain observation-only.

Full Samsung source and live LAN acceptance passed
on H2 SHA `750c4b3`; the owner's Chrome file-picker
gate remains open. See [H2 checkpoint](checkpoints/2026-11-07-h2-static-hosting-source.md).

## H3.4 parallel source candidate

The host adapter now implements explicit Termux HOME/PREFIX/shared
filesystem roots, selected registered runit units with autostart/logs,
fixed Restic backup scopes, a manually launched loopback ttyd process
and a typed local agent request contract. The CMS renders these in
dedicated tabs. No feature module independently invokes a shell or
imports host filesystem primitives.

This source candidate is owner-approved without a password dependency.
It neither changes the installed Local Agent nor grants any new public
network listener. Full Samsung source and live device validation
remain distinct gates.
