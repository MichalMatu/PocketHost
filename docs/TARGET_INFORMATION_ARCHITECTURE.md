---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Approved navigation and ownership boundary for future modular PocketHost
---

# PocketHost Target Navigation and Ownership

## Decision versus deployed state

The approved future product is **a modular Termux/Android platform**,
not just a hosting panel. Existing app navigation and hardcoded
legacy adapters are transitional; this document is not a declaration
that the new modules or routes are deployed. Preserve the current
H2 static sites, routes and upstream admin screens until a tested
migration explicitly replaces them.

**Hosting only contains projects users create in PocketHost.**
Already-running Termux sites, external processes and historic
IleStoi/PhotoMap names are never automatically imported as
Hosting projects. PhotoMap TEST and its isolated PRoot candidate
remain separate from regular System observations and do not
authorize production PhotoMap control.

## Target navigation

| Main area         | Target purpose                                                                 |
| ----------------- | ------------------------------------------------------------------------------ |
| Dashboard         | Cross-module health, alerts and owned project state                            |
| Hosting           | Overview, Projects, Deployments, Domains & Routing, Storage & Backups, Logs    |
| Modules           | Node.js, Python/PRoot, SSH, Cloudflare; future Databases                       |
| Termux/System     | Monitoring, Processes & Services, Packages, Files, Terminal, System Backups    |
| Android & Shizuku | Applications, CPU & Processes, Permissions, Services, Advanced Shell, Hardware |
| Automation        | Agents, Tasks, API                                                             |
| Platform          | Network Access, Diagnostics, Settings, Appearance                              |

The old five-area UI proposal is superseded by this module-first
target. Keep route compatibility and test navigation when migrating.

## Architecture boundaries

- **ModuleRegistry:** available runtime/infrastructure capabilities,
  versions, configuration and their own module-level pages. A Node
  module is not a project, and a Cloudflare module is not the
  owner of every observed tunnel.
- **ServiceRegistry:** one exact verified owner, runit service identity,
  desired/observed state, health policy and logs. Generic System
  may *observe* an unknown service; it cannot adopt or signal it.
- **ProjectRegistry:** created inside PocketHost only, with
  versioned components, module links, owned ports/processes,
  release pointers, storage, secret references and selected routes.
- **Hosting:** orchestrates the public contracts of those registries,
  not direct package installation, SSH keys, cloudflared or Restic
  process supervision. Host adapter alone performs OS/process work.

Shared facilities should reuse Termux runit, existing H2 release
and ownership guards, Restic and official dependency managers;
do not invent parallel process supervisors, tunnel controllers
or backup engines. Record proven ownership before any lifecycle
action; network and filesystem probing are not proof of identity.
Data/schema rollback is separate from code release rollback.

## Source preservation and removal targets

| Historical code                                              | Direction                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| H2 static fleet, site bundle validation, release history     | Preserve and generalize as first Hosting adapter                                       |
| P3 owned demo routes/server                                  | Keep compatibility until explicit migration/retirement                                 |
| Named read-only IleStoi/tunnel/SSH service snapshots         | Evolve to generic external observations; no takeover                                   |
| PhotoMap TEST adapters and legacy event endpoint             | Isolate from generic System/Hosting, retain only reviewed compatibility                |
| Site-specific supervision and per-module package/backup code | Consolidate behind verified shared host contracts, never duplicated                    |
| Native Shizuku Companion                                     | Keep Android loopback bridge; actual ADB/root UID and OS authorization determine power |

## Migration order

1. Inventory exact existing code and owner records, not a guessed
   live service list. Freeze external ownership and verify H2 parity.
2. Introduce typed declarations, revisioned private registry store
   and positive owner checks; never auto-register discovered PIDs.
3. Build one shared runit/service lifecycle interface with a
   bounded, manual-disable-aware health policy and backup contract.
4. Prove user-created disposable Node Hosting end to end before
   broad multi-component deployment or external tunnel changes.
5. Expand modules and separate routes, then stage one workload
   at a time with copied data, independent recovery and verified
   old/new process identity. **Local Agent migrates last**.

No step above is permission to modify active IleStoi, PhotoMap,
Cloudflare, SSH, Local Agent, production databases or external
runit entries. See [roadmap](ROADMAP.md),
[architecture](ARCHITECTURE.md),
[shared module contracts](MODULES.md) and
[upstream reuse decisions](UPSTREAM_REUSE_STRATEGY.md).
The earlier 29 KB source inventory remains in Git history
at commit 685daea477ab5e4de63e8bd99bf20c10c7647bd9.
