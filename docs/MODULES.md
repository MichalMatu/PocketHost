---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Define module ownership and contracts for Observability
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
