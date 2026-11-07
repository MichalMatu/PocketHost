---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: List modules, responsibilities and allowed dependencies
---

# Module Boundaries

## Rules

Every module owns a single capability, has its own `src/modules/<name>/AGENTS.md` and `docs/modules/<name>.md`, and communicates via explicit exported contracts. `ui` calls application ports; only the host adapter may execute Termux commands. Shared types may live in `src/shared` but must not become a catch-all service module.

| Module        | Role                                              | Side effects in first milestone        |
| ------------- | ------------------------------------------------- | -------------------------------------- |
| `host`        | Single approved OS/process adapter                | Read-only probes only                  |
| `inventory`   | Detect existing services and ports                | None; read-only                        |
| `runtime`     | Start/stop PocketHost-owned server                | Disabled until ownership model exists  |
| `packages`    | Discover and eventually install allowlisted tools | Inventory only; installations disabled |
| `sites`       | Track PocketHost-owned site metadata              | No adoption of existing services       |
| `config`      | Validate application settings                     | Read-only, no host config writes       |
| `diagnostics` | Report health and sanitized logs                  | Read-only                              |
| `ai`          | Future authenticated publish API                  | Entirely disabled                      |
| `ui`          | Local dashboard                                   | No shell access                        |
| `shared`      | Type contracts and safe utilities                 | No host access                         |

## Enforced import boundary

No feature module may import another feature module's implementation. UI may import shared typed contracts, not module internals. Only `host` may import Node host I/O and process libraries. A dependency-free static boundary gate enforces these rules during foundation; a syntax-aware linter is planned for later development.

## Ownership model

Discovery is not adoption. Every externally discovered service has `owner: external` or `owner: unknown`; only a registration explicitly created by PocketHost can be `owner: pockethost`. Runtime operations must require the latter plus an exact persisted instance identifier.

## Future changes

Adding a module requires an ADR or approved architecture update, a matching docs page, a scoped `AGENTS.md`, an entry in `project.structure.json`, test contract and gate update. A new module must not bypass established safety boundaries.

## Registered runtimes and adapters — 2026-11-07

The reusable `ManagedRuntimeRegistry` only exposes explicitly registered IDs and
unique ports. It cannot adopt discovered services. The generic process supervisor
requires a verified owner before Start/Stop signals and refuses uncertain descendant
cleanup. App-specific manifest, workset and guest commands belong solely to their
host adapter (PhotoMap is one example), not the shared runtime.
