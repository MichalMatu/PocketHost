---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: M0 read-only source and upstream reuse audit, ownership-safe decoupling backlog and precise open acceptance gates
---

# M0 — read-only source and upstream reuse audit

## Scope, status and source authority

**Result: M0/R0 source audit and reuse decisions DOCUMENTED; M0
code decoupling and full acceptance OPEN.** The owner explicitly
instructed this chat to **not modify source code** while another
chat works on it. This sprint used read-only GitHub Connector
inspection and documented findings; it did not run tests,
deploy, install packages, change Termux service state, modify
Cloudflare routes, query live phone processes, or start a new
Local Agent task. No native or live PASS is claimed here.

Frozen inspected source:
- PocketHost `main@4a52abef3d33bd1c9664fe2a0484ea18de738109`;
  its live Samsung checkout may be a **different SHA**.
- IleStoi `main@ea1b300351d6519ba387d08cb22d6aea2b204d2c`.
- Local Agent `main@0a17e90dce9c92a1d9f9667aa55c50b2f8af7efc`.
- The current PocketHost `main` may advance independently during
  another chat's work. Re-fetch and compare before executing M0 code
  edits or treating this inventory as an up-to-date diff.

Product authority: [roadmap](../ROADMAP.md),
[target architecture](../TARGET_INFORMATION_ARCHITECTURE.md),
[upstream reuse matrix](../UPSTREAM_REUSE_STRATEGY.md),
[development plan](../DEVELOPMENT_PLAN.md),
[quality gates](../QUALITY_GATES.md), and
[ADR-0014](../adr/0014-termux-panel-supervision.md).

## Previously accepted evidence, not a fresh device measurement

- H2 accepted exact-source native and guarded LAN G2/G3 for
  `750c4b3fba2126647c3b593ae89d108ba2a67206`,
  including two disposable static sites, ZIP/folder delivery,
  HTTP health, revised release, rollback, process verification
  and no protected-service interference. See the
  [H2 checkpoint](2026-11-07-h2-static-hosting-source.md).
  This does **not** certify the current `main` source.
- The separate
  [code/quality/hardware checkpoint](
  2026-11-09-code-quality-structure-handoff.md)
  records a panel-only `runit` recovery, local/LAN HTTP 200
  and preservation of six protected services on 2026-11-09.
  It explicitly leaves full-phone reboot, Android force-stop,
  extended watchdog and any post-checkpoint liveness OPEN.
- No current M0 browser click, native QA suite, live service
  inventory, source-to-running-checkout match, or phone restore
  was performed in this read-only sprint.

## Actual code inventory and M0 preservation decisions

| Current capability | Confirmed code or contract | M0 decision / missing work |
| --- | --- | --- |
| User-created static sites | `src/modules/host/site-fleet-host.ts`, `src/modules/sites/site-bundle.ts`, `site-fleet-server.mjs`, `site-fleet-proxy.mjs`, `apps/admin/src/app/sites/page.tsx`; bounded uploads, immutable revisions, exact PID/start-ticks, loopback and rollback | **KEEP as-is during M0.** Do not rewrite it or switch its existing direct-child lifecycle to runit merely to match the future Node module |
| Older single demo | `src/modules/host/owned-site-host.ts`, `apps/admin/src/app/owned-site/page.tsx`, `apps/admin/src/app/deployments/page.tsx`, dedicated `/api/v1/owned-site` routes | Historical separate P3 project and API remain active source dependencies. De-duplicate only after all UI consumers/owned records/rollback links have compatibility coverage |
| PhotoMap TEST catalog | `src/modules/host/managed-photomap-host.ts`, `apps/admin/src/app/managed-projects/page.tsx`, `/api/v1/managed-photomap` | Named source coupling remains. It is an intentionally stopped/read-only candidate; preserve imported files and any original externally run service. Remove UI/API references only in coordinated future source work |
| PhotoMap PRoot runtime | `photomap-runtime-host.ts`, `photomap-runtime-plan.ts`, `src/modules/runtime/photomap-runtime.ts`, imported by `apps/admin/vite.config.ts` | Generic process guards are reusable; hard-coded fixed PhotoMap identity, PRoot settings, ports and data are **not** a generic Python module |
| Monitored external services | `src/modules/host/host-snapshot.ts` has named `SERVICE_CATALOG` for IleStoi, Cloudflare, SSH, MQTT, healthwatch and Local Agent | Replace named *product* monitoring with generic OS/runit observation in later code; keep external ownership and guardrails. Do **not** grant a Hosting project ID from observation |
| Runit administration | `src/modules/host/termux-service-admin.ts`: explicit target registration, protected names, verified target path, bounded logs, fixed CLI actions; `tests/quality/h3-runit-service.test.mjs` | **KEEP protection and OS-admin distinction.** Its registration of an *existing nonprotected runit unit* is a user-directed Termux administration feature, **not** permission to auto-adopt it as a Hosting project |
| Panel self-recovery | `ops/termux/install-panel-services.sh`, `panel-service.sh`, ADR-0014 use existing `service-daemon`/`runit` plus fixed panel-only watcher | Keep these working scripts and their independent recovery semantics. Do not create a second Termux supervisor or infer service ownership by port |
| Typed generic runtime | `src/modules/runtime/managed-runtime-registry.ts`, `managed-runtime.ts`, `src/modules/host/managed-process-supervisor.ts` | Reuse explicit registry, process guards, stop/readiness helpers; snapshot policy currently requires `autostart === false`. Future module service autostart needs a reviewed extension, **not** a blanket boolean flip |
| Termux package tools | `termux-package-catalog.ts`, `observability-probes.ts`, `termux-admin.ts` | Reuse `dpkg-query`, `apt-cache`, reviewed `apt` operations; add scoped app-local Node/Python dependencies later. Do not implement another apt or allow app deploy to run global `pkg upgrade` |
| Restic / file management | `termux-restic-admin.ts`, `termux-admin.ts`, `termux-file-roots.ts` | Reuse bounded CLI adapter, snapshots/staged restore; current H3 scopes do **not** prove backup/recovery for future project DB/uploads. M2 must define project-specific restore and concurrency locks |
| LAN and hosted previews | `lan-gateway.mjs` and `site-fleet-proxy.mjs`: current owner-approved private LAN admin and GET-only H2 preview | Preserve exact URL/bind/port behavior until migration is tested; do not expose an unauthenticated administrative LAN endpoint through Cloudflare |
| API composition | `apps/admin/vite.config.ts` (~1,226 lines at audit SHA) imports P3, PhotoMap, H2, Termux, Shizuku and LAN handlers | **Highest-value decoupling target**: split composition behind stable API/typed adapters later, *without* deleting working endpoints before callers are migrated |
| Navigation/duplicate UI | `apps/admin/src/config/navigation.ts`, `routes.tsx`, `termux/page.tsx`, `termux/admin-actions.tsx`; System shows H2 site lifecycle, Hosting exposes H2+demo+PhotoMap routes | Separate generic Termux Processes/Services from Hosting Projects, preserve old deep links until compatibility checks. Menu restructuring alone is **not** an ownership or backend migration |
| Android & Shizuku | Native companion / Shizuku transport and dedicated UI/routes | Independent Android privilege domain. M0 Hosting refactoring must not change native Binder paths or privilege policy |
| Automation / Agent | `termux-agent-contract.ts`, Agent panel and external Local Agent repo | Consume existing explicit Agent task/result contracts later; no duplicate Git poller, Agent reinstallation or self-cutover |

The existing `tests/quality/site-fleet-host.test.mjs` contains
foreign-port, forged-PID, owner-marker and symlink negative cases;
`h3-runit-service.test.mjs` covers explicit registration and
protected names. **Presence of these source tests is not a test run.**

## R0 — capability-by-capability reuse-first decisions

Priority: **existing PocketHost -> existing owner project -> installed
official Termux/CLI -> narrow third-party design -> new adapter glue**.
Never copy a complete dashboard/supervisor to accelerate M0.

| Planned capability | Source to reuse | Needed PocketHost glue | Decision / stop condition |
| --- | --- | --- | --- |
| Static frontend, releases and rollback | H2 SiteFleetHost, site-bundle parser, owner/port guards | Registry binding and stable Hosting project facade | **REUSE FIRST**; never substitute a new static engine |
| New Node app (M3) | Termux Node/npm, project `package.json` + lockfile, `npm ci`; H2 staging/release | Owned Node component launch, health, logs, sealed dependency plan and runit registration | **Thin native adapter**; pilot before broad wizard |
| Python app (M4) | Termux Python `venv`, native pip/lock-compatible requirements; optionally `termux/proot-distro` | Per-project interpreter/environment, paths, lifecycle and failure reporting | **Opt-in PRoot** only after native descendant/orphan gate |
| SSH | Existing Termux `sshd` + authenticated keys and runit control | Module configuration/status, safe key-reference UI, rollback of config | **Do not replace sshd** or change currently working keys/port during M0 |
| Cloudflare | Existing `cloudflared` CLI + IleStoi named tunnel runner and conditional public/origin policy | Single shared module, explicit route references and staged ingress validation | **Do not duplicate tunnel** or treat external service reference as control right |
| Service autostart and liveness | `termux/termux-services` runit, `termux/termux-boot`, PocketHost panel scripts | Verified service ownership and policy-specific health evaluator | **No second daemon**; preserve manual `down` and OEM Android limits |
| Backup and restore | Restic CLI, `termux-restic-admin.ts`, IleStoi backup with `flock`/retention | Project-scoped source/restore manifests, data locking and tested recovery | **Do not equate code rollback to database restore** |
| Host packages | Termux `pkg`/`apt`/`dpkg-query`, current H3 package handlers | Install/update previews, compatibility and per-runtime scope | **No custom package manager** or automatic global upgrades |
| Shell/terminal | Existing H3 terminal adapter, optional `ttyd` external CLI | Private LAN route and ownership checks | **HOLD**: historical native ttyd SIGSEGV, do not assume installing the tool resolves it |
| Hosting UX and process roles | H2 UI, selected `piku/piku` Procfile/release concepts, optional `himalayladha/termux-hosting-panel` layout ideas | Minimal project wizard, component contracts | **Patterns only**; never copy lower-reviewed command/path security or whole panel |
| Android capabilities | Existing PocketHost companion/Shizuku and optional installed Termux:API | Explicit independent capability bridge | **No duplicate privilege transport** |
| Agent service migration | Local Agent private runit boot, durable claim/UNKNOWN/no-replay/STOP | New explicit managed service config, externally operated handover | **Last target**, no queued self-shutdown, no concurrent consumer |

External source/licensing references and caveats:
[upstream reuse strategy](../UPSTREAM_REUSE_STRATEGY.md),
[termux-services](https://github.com/termux/termux-services)
(GPL-3.0),
[Termux:Boot](https://github.com/termux/termux-boot),
[proot-distro](https://github.com/termux/proot-distro)
(GPL-3.0),
[cloudflared](https://github.com/cloudflare/cloudflared)
(Apache-2.0),
[Restic](https://github.com/restic/restic) (BSD-2-Clause),
[ttyd](https://github.com/tsl0922/ttyd) (MIT),
[Piku](https://github.com/piku/piku) (MIT).
Record exact package version/commit, README license/NOTICE and
Samsung ABI before source import or installation. No root PocketHost
`LICENSE` was present at the inspected revision; **settle explicit
project-license/provenance policy before vendor copies**. That is
a documentation/ownership decision, not a request to silently assign
a new license.

### Existing owner project special constraints

IleStoi at the audited commit:
- `deploy/termux/00-services.sh` uses existing standard Termux
  `service-daemon`; honors `down` markers and starts the known
  services. PocketHost panel runit uses the same manager.
- `cloudflared.run` uses the configured named tunnel
  `~/.cloudflared/config.yml` and private credentials, not a
  second tunnel per site.
- `ilestoi-healthwatch.py` checks local readiness, public live,
  internet and disable marker at a 180-second cadence; it restarts
  only the tunnel after repeated qualifying public failures and
  a cooldown. Distinguish tunnel failure from origin failure.
- `wreckscanner-backup.run` uses serialized `flock`-guarded
  backup and maintenance. SQLite/media require a planned single
  writer, compatible data restore and retention.

Local Agent at the audited commit:
- Private `runit` directory and boot hook are independent of
  ordinary system runit; `run.example` invokes a pinned bundle
  through `python3 -B -m termux_agent ... serve`.
- Its private claims/results and STOP/UNKNOWN no-replay properties
  cannot be replaced with ordinary HTTP health restarts or generic
  PID-only supervision.
- Migration must use an **independent operator channel**, preserve
  credentials and installed identity, and prove a real post-cutover
  Git task/result round trip; never drain or stop the Agent by the
  very queued task it is executing.

These are **source contracts**, not observations of today's actual
phone configuration. Do not copy private paths, credentials or
live data into PocketHost docs or future manifests.

## Source-code decoupling backlog — for the other implementation chat

Ordered to minimize regression; **none performed here**:

1. **Baseline map:** check fresh `main`, exact H2 project IDs,
   active release pointers, P3 demo, protected runit service states,
   panel/lAN HTTP and the current dev checkout before editing.
   Preserve old deep links and named product data until replaced.
2. **UI-first compatibility:** add the proposed Dashboard/Hosting/
   Modules separation without removing `/sites`, `/owned-site`,
   `/deployments`, `/managed-projects` routes before callers
   and tests are migrated. Distinguish generic System service
   inventory from PocketHost-created Hosting catalog.
3. **Named observation cleanup:** remove named IleStoi/PhotoMap
   *product cards* from the future generic Hosting interface,
   not their external runit units. Keep positive ownership and
   the existing protected names through transition.
4. **API composition:** separate the old PhotoMap read-only
   endpoint and fixed P3 demo endpoints from new project routes
   behind compatibility adapters. Refactor the `vite.config.ts`
   composition in small slices, preserve H2 `/api/v1/sites`,
   LAN preview `/h2/*` and exact port behavior.
5. **Stop at M0:** do not introduce three working registries,
   autostart for hosted projects, dynamic Node execution, new
   public tunnels, secret migration or a second supervisor
   during M0. Those are M1–M5 with separate acceptance.
6. **Native closeout:** focused nav/API and negative tests,
   verify static Create/Start/Publish/Rollback, old route
   compatibility, no foreign lifecycle controls, and compare
   six protected services + owned H2 data before/after.
   Record exact application SHA and host receipts. Leave
   anything untested OPEN.

**Suggested negative case matrix:** API backward compatibility,
old deep-link navigation, no accidental PhotoMap start, service
name alias/symlink and foreign PID denial, occupied H2 port,
forged owner marker, intentional `down` marker, H2 release
restore, and LAN gateway read-only site proxy. Avoid running
the whole hardware suite for a documentation-only edit.

## M0 acceptance ledger

| Work item | Status | Evidence / next action |
| --- | --- | --- |
| Fresh main and source/AGENTS inspection | **DONE — source snapshot** | GitHub read-only `4a52abe`; no phone invocation |
| Current ownership and external-code coupling inventory | **DONE — source analysis** | Code paths and affected UI/API above |
| Upstream reuse/licensing decision R0 | **DONE — planning** | Capability table, links, adoption gates above |
| Identify safe decoupling sequence | **DONE — plan** | Ordered backlog above; code unmodified |
| Remove product-specific source integration | **OPEN — deferred by owner** | Another chat is actively editing code; no overlapping write authorized |
| Verify new M0 `main` is still H2-compatible | **OPEN** | Native Samsung exact-source QA and browser checks only after implementation |
| Revalidate protected services, site data and panel | **OPEN — not measured here** | Compare physical device pre/post when code changes are deployed |
| Mark full M0 gate PASS | **NOT YET** | Requires all relevant source changes and accepted evidence |

**Handoff:** Implement the decoupling only in the separate active
code chat, using fresh HEAD. This audit is the M0 source map
and an explicit no-code-change checkpoint, not proof that
implementation M0 finished. Proceed to M1/M2/M3 only once
the actual M0 compatibility and service-preservation gates
have been recorded or their remaining work explicitly scoped.
