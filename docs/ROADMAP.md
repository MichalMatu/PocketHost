---
status: active
owner: core
last_reviewed: 2026-11-12
purpose: Canonical Hosting-first Basic delivery priorities and future modular milestones
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

For the **deferred one-APK program** see
[ADR-0017 Termux-first integration](adr/0017-termux-first-single-app-integration.md)
(I0–I4). This future integration reuses official Termux source/packages,
selected Termux:API/Boot functionality, Companion and Shizuku; it is
not required for the current Termux-installed Basic MVP. Do not build an
independent package manager, host engine or custom-prefix runtime.
No earlier QA is recertified.

## Current product decision — functional Basic and Pro

**Basic and Pro describe technical dependencies, not price or a
free/paid feature limit. Both must be fully functional in their scope.**

- **Basic:** full website/application hosting and administration using
  only official Termux and supported packages. Git/GitHub, SSH,
  Cloudflare, project traffic analytics, files, terminal and backups
  belong to Basic; external web services are allowed, but separate
  Android helper APKs are not required.
- **Pro:** additional Android/system capabilities that require separately
  installed Android applications or authorizations (e.g. Companion
  and Shizuku). Existing Pro code stays preserved but **frozen**.
  Basic must never depend on its presence, status or permissions.

**Current product:** PocketHost inside official Termux, managed through
one web panel. Existing H2 static hosting is retained, not rewritten.
Cloudflare Pages is optional for static sites; phone-hosted services
use explicit origin routes. The future unified Android APK/I0–I4 is
**deferred**, not the Basic MVP path.

## Next two development tasks — Hosting first

1. **P0 — complete Node.js Hosting + GitHub deployment.** Reuse M1–M3,
   H2 releases and the one verified runit adapter. From the current
   panel, create/import a disposable user-owned project (folder/ZIP
   or GitHub repository), inspect an explicit dependency plan,
   install/build after approval, start/stop/restart, prove local
   readiness, inspect logs, update/pull/publish and safely roll back.
   A source candidate is not a successfully running Node service.
2. **P0 — finish the Hosting management panel.** Integrate
   Cloudflare Tunnel, domains and HTTPS publishing; SSH configuration;
   per-site **web traffic analytics** (requests, visitors and errors
   when data is actually available, not Android-wide RX/TX);
   file/terminal workflows; scoped Restic backup and verified restore.
   Reuse official Termux tools and existing PocketHost contracts.
   No adoption or change to external existing services without
   separate explicit authorization.

**Menu/navigation:** keep the current menu and routes unchanged
during these two tasks. Reorganize by Basic/Pro only later after the
Hosting flow works; avoid UI churn and duplicate admin surfaces.

**After these two tasks:** make a versioned PocketHost bundle and
a repeatable **one-command installer for official Termux** using its
own pkg/npm tooling, with minimal required dependencies and optional
packages configured in the panel. Exercise a clean-install smoke
early, but finish full installer polish after working Hosting.
Then perform exact-source Samsung browser/device acceptance:
GitHub -> running Node -> Cloudflare -> update/rollback -> backup
and restore, plus permissions, restarts and error paths. Do not
expose the current unauthenticated DEV admin panel publicly.

**Not a blocker now:** Pro/Companion/Shizuku expansion, unified APK,
Python/PRoot and additional runtimes, automatic adoption/migration
of IleStoi, PhotoMap, Local Agent or other live services. No source,
APK, menu, process or production service change is authorized by
this roadmap alone.

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
| M4 — P0 | SSH, Cloudflare/domain/HTTPS and per-site web analytics integrated with Hosting; Python/PRoot deferred                                         | Independent ownership; verified public origin routing and traffic measurements; no external service takeover                 |
| M5 — P1 | Multi-component Hosting wizard, source import, reviewed dependencies, optional routes, storage, secrets and coordinated release                         | Node frontend+backend and worker failure/rollback/data-restore scenarios                                                     |
| M6 — P1 | Explicit staged migration of existing owner workloads, **Local Agent last**                                                                             | Independent SSH/USB recovery, final data sync, one queue consumer, Android reboot/Wi-Fi/suspend/health acceptance            |
| M7 — P2 | Python/PRoot, further runtimes/databases, richer secret management, scheduled operations, authenticated API and hardening                                             | Separately scoped security, recovery and public-access acceptance                                                            |

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
