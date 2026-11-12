---
status: active
owner: core
last_reviewed: 2026-11-12
purpose: Canonical target sequence and acceptance outcomes for modular PocketHost
---

# PocketHost Roadmap

## Direction

**PocketHost = modular platform; Hosting = orchestrator of reusable
modules.** The target is not proof of implementation or deployment.

Three independent identities:

- **ModuleRegistry** — Node.js, Python/optional PRoot, SSH,
  Cloudflare, future database capabilities and configuration.
- **ServiceRegistry** — one verified lifecycle owner for each
  explicitly managed runit service, independent desired/observed
  states and bounded health policies.
- **ProjectRegistry** — only user-created Hosting projects,
  versioned components, module references, ports, releases,
  secrets references, persistent data and routing.

A discovered process/site cannot become a Hosting project or
managed service by name, port, PID or inventory entry. Reuse existing
H2 ownership/releases, Termux runit, official CLI, Restic and
typed shared contracts; do not import an entire third-party panel
or create a second process manager. See
[architecture](ARCHITECTURE.md),
[target navigation](TARGET_INFORMATION_ARCHITECTURE.md) and
[upstream/licensing review](UPSTREAM_REUSE_STRATEGY.md).

## Current position

Historical H2 static Hosting and the owner-directed Termux/Shizuku
DEV panel have real source/device evidence at _older_ SHAs. M0
Hosting/System separation is implemented in source. M1 versioned
registry validation, private store, ownership diagnostics and
restore/rollback protections are source candidates. Full
current-SHA acceptance and physical G3 remain OPEN; no automated
external-service adoption or dynamic Node Hosting is accepted.
See [compact handoff](HANDOFF_NEXT_CHAT.md).

## Delivery stages

| Stage   | Deliverable                                                                                                                                             | Acceptance boundary                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| M0 — P0 | Reuse audit, preserve H2, separate generic Termux/System from Hosting and PhotoMap diagnostics                                                          | Static Create/Start/Publish/Rollback still works; external services untouched                                                |
| M1 — P0 | Versioned Module/Service/Project declarations, components, secret refs and private persistence                                                          | Reject duplicate/stale identities, collisions, foreign ownership and unsupported migrations; rollback/restore negative cases |
| M2 — P0 | Reviewed dependency plans; single runit adapter, bounded health/recovery policy, scoped backup/restore                                                  | Disposable restart/failure/disable/restore pass; no unowned process signalled                                                |
| M3 — P0 | First **disposable user-created Node.js** project, minimal browser wizard, manifest/lockfile, local build/start/readiness, staged versions and rollback | Real browser flow, safe failed update, restart/recovery and verified no interference with H2/other Termux sites              |
| M4 — P1 | Separate SSH and Cloudflare modules plus second Python/venv runtime, optional PRoot                                                                     | Distinct ownership, no duplicate shared daemon, correct external-vs-origin health and rollback                               |
| M5 — P1 | Multi-component Hosting wizard, source import, reviewed dependencies, optional routes, storage, secrets and coordinated release                         | Node frontend+backend and worker failure/rollback/data-restore scenarios                                                     |
| M6 — P1 | Explicit staged migration of existing owner workloads, **Local Agent last**                                                                             | Independent SSH/USB recovery, final data sync, one queue consumer, Android reboot/Wi-Fi/suspend/health acceptance            |
| M7 — P2 | Further runtimes/databases, richer secret management, scheduled operations, authenticated API and hardening                                             | Separately scoped security, recovery and public-access acceptance                                                            |

## Hard dependencies

- **R0 reuse gate:** identify current implementation or official Termux
  alternative before adding a new dependency; pin version/license,
  provenance, interface and Android compatibility.
- **M1 owner gate:** declared identity and verified process ownership
  remain distinct; unknown ownership is not a lifecycle capability.
- **M2 reliability gate:** no daemon besides existing Termux runit,
  no automatic restart that overrides manual disable; different
  workloads require different health policy and retry budgets.
- **M3 release gate:** staged source revision, local dependency plan,
  actual readiness, retained good rollback and independent plan for
  mutable data/schema. A code rollback is not database rollback.
- **M6 migration gate:** old services stay operational until a
  separately approved cutover. Never migrate IleStoi, PhotoMap,
  SSH, Cloudflare or Local Agent just to demonstrate the new API.
  Local Agent must not stop itself through its own queued task.
- **Security:** existing owner-private LAN HTTP console is not
  safe to expose on WAN. Binder/Shizuku capabilities depend on
  actual authorization and Android UID, never pretend ADB is root.

Before a new M3 feature sprint, close the [current source repair
verification](checkpoints/2026-11-12-general-repository-repair-continuation.md)
on exact Samsung SHA; do not conflate it with disposable G3 acceptance.

## Iteration policy

For each small DEV slice use fresh main, smallest relevant Samsung
Local Agent checks and HMR. Whole suites/builds belong at milestone
or safety-impact closeout. Historical QA does not certify a newer
commit; see [quality gates](QUALITY_GATES.md). Detailed 2026-11-05
through 2026-11-09 release chronology is in
[checkpoint archive](checkpoints/README.md) and the older roadmap
revision at Git commit 685daea477ab5e4de63e8bd99bf20c10c7647bd9.
