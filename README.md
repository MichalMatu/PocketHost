# PocketHost

**PocketHost** is a self-hosted management and application-hosting panel for **Android running official Termux**. It provides one place to inspect the host, manage owned services, and publish static websites or trusted Node.js applications. The current product is an owner-operated **private-LAN MVP**, not a public multi-tenant hosting service.

## Features

- **Host and services:** dashboard, health/diagnostics, runit service inventory, manual recovery controls, Termux packages, SSH and terminal.
- **Static Hosting:** create owned websites from HTML, folders or ZIP archives, inspect releases, update content, serve over HTTP and roll back.
- **Node.js Hosting:** owner-gated source intake, dependency/build preparation, guarded release deployment, start/stop, readiness checks, logs, update and rollback.
- **Operations:** project inventories, release histories, bounded runtime logs, an independent Local Agent console, local MQTT diagnostics and on-demand health checks.
- **Backups:** encrypted on-device Restic snapshots of the scoped Node project source, with an **isolated staging restore** verified on Samsung A8. Versions/rollback are distinct from backup.

## Verified baseline

On **23 November 2026**, source `d2bacd081ad0879d49a08e3c7fd97789185ad6e4` passed the complete A8 G0–G2 qualification: **486/486 UI assertions**, **469 Node tests passed / 1 skipped**, **76.11% Node line coverage**, structure/boundaries/budgets, lint, formatting, TypeScript and production Vite build. See [quality evidence](docs/QUALITY_GATES.md).

The last separately attested **deployed DEV** revision was `349087d2981c7fc3d8b9feba12d8fc335956a08b`; a successful source test is **not** a device deployment. The owner has accepted the browser UX at the present stage. No Android reboot, full-device-loss recovery or public-hosting certification is implied.

## Scope and safety

- The development admin interface is intentionally **unauthenticated** and must remain inside a **trusted private LAN**. Do not publish or port-forward the management interface, SSH or MQTT.
- Trusted hosted Node code runs under the **same Termux UID**; it is not a container or sandbox for untrusted workloads.
- A local encrypted Restic restore and integrity verification do **not** establish off-device disaster recovery. Preserve backup credentials separately and qualify off-device recovery before relying on the phone as the sole copy.
- Android reboot persistence, external tunnel ingress and untrusted-app isolation are separate future work.

## Repository layout

| Location | Purpose |
| --- | --- |
| `apps/admin` | Browser panel and Node-side Vite API integration |
| `src/shared`, `src/modules` | Portable contracts and Termux host adapters |
| `ops/termux` | Guarded A8 host and deployment operations |
| `scripts`, `tests` | Quality gates, targeted QA and tooling |
| `docs` | Current architecture, maintenance and acceptance evidence |

The workspace specifies **Node.js 22+**. Development dependencies are declared in the root and `apps/admin/package.json`. For an A8 deployment or tests, use the existing paired Termux Local Agent and its SHA-pinned guarded workflow—not a generic local run or an unguarded service restart.

## Documentation

Start with [documentation index](docs/README.md), [architecture](docs/ARCHITECTURE.md), [current handoff](docs/HANDOFF_NEXT_CHAT.md) and [agent rules](AGENTS.md). Detailed historical development logs remain available in Git history rather than filling the current documentation tree.

## Next development stage

**Release baseline: `v1.0.0` (source-only freeze).** No new build, device deployment or tests were performed for this documentation-only closeout. When development resumes, start with [the ordered v1.1 roadmap](docs/ROADMAP.md): traffic analytics, then read-only SQLite Studio, then optional HTML/Node starters. Use [TermuxPanel by Himalay Ladha](https://github.com/himalayladha/termux-hosting-panel) as a selectively reviewed MIT-licensed reference; do not merge its entire backend. See [upstream reuse notes](docs/UPSTREAM_REUSE_STRATEGY.md).
