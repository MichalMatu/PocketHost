---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Canonical modular-platform roadmap; Hosting orchestrates reusable runtime and infrastructure modules
---

# PocketHost Roadmap

## Accepted target — modular PocketHost platform (2026-11-09)

**PocketHost = modular platform; Hosting = orchestrator of modules.**
This is the approved **target**, not a claim of deployed functionality.
Existing H1/H2/H3/O1/Shizuku results below remain historical evidence;
older "next milestone" labels do not override the sequence here.

### Three distinct layers

1. **Modules:** Node.js, Python (optional PRoot), SSH, Cloudflare and
   later Databases. Each has its own UI, configuration, real capabilities,
   dependency inspection and diagnostics. A module is not necessarily a
   persistent service: Node/Python are runtime providers; SSH and
   Cloudflare also expose infrastructure endpoints.
2. **Managed services:** individual, explicitly registered processes
   (including application components or shared `sshd`/`cloudflared`)
   with a single verified lifecycle owner, a desired state, an observed
   state, logs and a policy. These are controlled through **one existing
   Termux `runit` supervisor path**, not parallel process managers.
3. **Hosting projects:** only projects the user creates through PocketHost.
   A project consists of `components[]` (static frontend, Node backend,
   Python worker, etc.), explicit module references, owned releases,
   persistent data and optional route bindings. Hosting consumes module
   capabilities; it does not reimplement them.

The target top-level menu is **Dashboard; Hosting; Modules; Termux/System;
Android & Shizuku; Automation; Platform**. SSH and Cloudflare have
their own pages under Modules. Hosting can *use* a shared Cloudflare
route or runtime without owning or duplicating its service process.
The [target navigation document](TARGET_INFORMATION_ARCHITECTURE.md)
defines the full menu; current source navigation is transitional.

### Required registries and shared platform facilities

- **`ModuleRegistry`:** stable module IDs, supported capability
  versions, availability and configuration schema.
- **`ServiceRegistry`:** immutable service ID, verified PocketHost
  owner identity, module/component references, runit registration and
  desired/observed lifecycle states. No lifecycle right is inferred
  from process name, PID, port, existing runit directory or discovery.
- **`ProjectRegistry`:** user-created project and `components[]`,
  release pointers, persistent storage, route IDs, `SecretRef` and
  service references. Declarative intent and live runtime observations
  are stored separately. All new manifests carry `schemaVersion`.

Use narrow typed contracts (e.g. `ModuleCapability`,
`DependencyPlan`, `ComponentRuntime`, `ServiceLifecycle`,
`HealthPolicy`, `SecretRef`, `BackupPolicy`); evolve the existing
`sites`, `runtime`, `host` and shared adapters instead of building
another framework. No arbitrary plugin execution or feature-to-feature
internal imports. Existing Termux service administration remains
separate from permission to manage a PocketHost-owned service.

Shared platform facilities, **not duplicate implementations per module**:

- **Dependencies:** inspect only explicitly selected source/manifests
  (`package.json` + lockfile, Python requirements/pyproject and
  supported service declarations). `Check` is read-only;
  `Install`/`Update` first preview an exact, reviewed plan.
  Global `pkg` updates are independent from app-local `npm ci`,
  venv/locked Python dependencies and optional PRoot environments.
- **Reliability:** one `SupervisorAdapter` delegates lifecycle to
  verified Termux runit ownership. A separate shared health-policy
  evaluator handles process exit vs readiness, startup grace,
  failure thresholds, cooldown, max recovery actions, manual `down`
  markers and diagnostic history. Never restart a tunnel because
  any arbitrary public HTTP request failed. No new competing daemon.
- **Secrets:** a minimal secret-reference contract, private
  on-device configuration/permissions and redacted diagnostics
  exist **before Cloudflare or dynamic production data**. Public
  keys and WebAuthn passkeys are different from private SSH keys.
  More advanced rotation/access policies may follow in M7.
- **Backup:** one backup/restore contract, with project-scoped
  data sources and adapters such as the existing Restic tooling.
  Releases are not backups; backup integrity and disposable restore
  must be demonstrated before migrating mutable workloads.
  Lock backup and retention/prune jobs against overlapping work.
- **Source/build/deploy:** isolated staging, pinned source/revision,
  dependency plan, build artifact integrity, readiness gate,
  atomic active-release pointer/route activation where supported,
  and a known rollback target. Application data and schema
  migrations are **not** rolled back merely by swapping code.

### Delivery roadmap with acceptance gates

**P0 = required for the first reliable dynamic project;
P1 = integrations and migration preparation;
P2 = later expansion.** Complete small end-to-end slices on Samsung,
not a large framework with no runnable project.

1. **M0 — P0 / baseline and decoupling.** Inventory H2 static sites,
   P3 demo, admin control plane and actual registered services.
   Remove product-specific IleStoi/PhotoMap knowledge from new
   Hosting interfaces; retain existing deny guards while replacing
   them with positive ownership. Preserve all live external
   services, existing H2 sites/releases and their network routes.
   **Done when:** H2 static Create/Start/Publish/Rollback still works,
   no foreign lifecycle action becomes available and no live
   production process or data is modified by this cleanup.

2. **M1 — P0 / identity and component contracts.** Introduce
   `ModuleRegistry`, `ServiceRegistry`, `ProjectRegistry`,
   versioned `components[]`, typed capability references and
   minimal `SecretRef`. Reuse the verified H2 owner identity
   and runtime registry, without inferring ownership from discovery.
   **Done when:** registry persistence/migration, duplicate IDs,
   stale identities, port collisions and unauthorized lifecycle
   attempts are covered by focused negative tests.

3. **M2 — P0 / shared execution and recovery foundations.**
   Build minimal manifest inspection and reviewed dependency plans;
   shared runit lifecycle adapter, health policy/events and
   scoped backup/restore contracts. Preserve per-workload policies:
   IleStoi public+origin+internet tunnel recovery, PocketHost panel
   watchdog and Local Agent UNKNOWN/no-replay are **not the same**
   restart rule. Wire small working facilities before adding
   abstraction points for unimplemented runtimes.
   **Done when:** owned process exit/health failure can be
   distinguished, cooldown and manual disable are honored,
   unowned processes are untouched, dependency changes are
   previewed, and a disposable backup+restore succeeds.

4. **M3 — P0 / early real Hosting MVP on Node.js.** Add a minimal
   `Create Project` path for one explicitly supplied Node source
   using the new component model; retain the existing H2 static
   path. Implement `package.json` + lockfile inspection,
   project-local `npm ci`, build/start, owned port, readiness,
   logs, versioned staged release and rollback. Keep controls
   local/private; **do not wait for SSH/Cloudflare/Python modules**
   or a fully featured wizard to prove Hosting.
   **Done when:** a disposable Node app is created from scratch
   in the browser, started, updated, failed safely, rolled back
   and restored after a controlled crash without touching H2,
   IleStoi, Local Agent or their ports.

5. **M4 — P1 / reusable infrastructure and second runtime.**
   Build distinct SSH and Cloudflare module pages plus a Python
   venv runtime module. SSH provides configuration, public-key
   management and independently healthy emergency access;
   never break existing `sshd` to test a new control panel.
   Cloudflare represents shared tunnel profiles, origin/ingress
   validation, routes and secret references with **one** process
   owner; showing an external existing tunnel does not authorize
   modifying it. Python dependencies and lifecycle run on
   a disposable, separately owned application. PRoot remains
   opt-in and subject to descendant/orphan acceptance.
   **Done when:** Node and Python adapters share contracts,
   module health differentiates external outage from origin
   failure, and SSH plus current production tunnel remain
   unaffected unless explicitly cut over.

6. **M5 — P1 / complete Hosting orchestration.** Expand the
   wizard to source ZIP/folder/explicit repo -> detect contained
   manifests -> configure multiple `components[]` -> dependency
   review -> secrets/storage/health/backup -> stage/test ->
   publish -> optional Cloudflare route. Keep H2 static UX
   as the fast path and immutable release model as its base.
   Add an integrated Node frontend+backend scenario, then
   Python workers/optional PRoot. Use a coordinated release
   plan for components; no direct Hosting writes into
   Cloudflare/SSH internals.
   **Done when:** multi-component start/update/rollback, routing
   validation, port conflict, persistent data restore and
   failure injection pass on disposable project fixtures.
   Schema/data migrations require compatibility or an
   independently tested recovery plan before publish.

7. **M6 — P1 / explicitly staged workload migration.** Recreate
   IleStoi (including its independent backup and health policy),
   then appropriate shared Cloudflare bindings, and **Local
   Agent last**, by provisioning new PocketHost-owned services
   rather than adopting running Termux processes. PhotoMap is
   optional as a fresh test project, never a required takeover.
   During staged tests use separate ports and copied data.
   **Done when:** verified independent SSH/USB rollback is
   available; a final data sync avoids concurrent SQLite writers;
   exactly one Cloudflare service owner and one Local Agent
   queue consumer exist; reboot, Wi-Fi loss/return, process
   crash, Android background suspension and service recovery
   pass on the actual phone. The Agent may never stop or
   replace itself through its queued task. Retire old boot/runit
   registrations only **after** each target passes.

8. **M7 — P2 / expansion and external-access hardening.**
   Additional database/runtime adapters, optional advanced
   secret rotation, scheduled operations, authenticated API,
   and hardened administration beyond the trusted private LAN.
   Production WAN/public administration is never enabled
   merely because M3 works.

### Cross-cutting verification and non-goals

- **Per module:** schema/config validation, real installed state,
  truthful unsupported state, dependency plan preview and explicit
  target identity; diagnostic output never leaks credentials.
- **Per service:** one owner, correct runit registration,
  process/start-identity checks, restart-loop protection and
  durable manual disable; unknown identity is not actionable.
- **Per release:** source/revision hash, staging, readiness, atomic
  activation where possible, retained prior release, log trace
  and tested rollback. Verify mutable data separately.
- **Per phone:** tested power/boot behavior, recovery after
  Termux/Android suspend, LAN versus origin/tunnel failures,
  disk pressure, backup/restore and safe remote SSH recovery.
  Never infer device PASS from a GitHub commit.
- **Explicit exclusions:** no automatic discovery/adoption of
  running Termux websites as Hosting projects; no unreviewed
  global package upgrades; no duplicate `cloudflared`;
  no second task consumer; no blanket health-failure restart;
  no premature shutdown of external services.
- **Security boundary:** the existing private-LAN HTTP DEV
  control panel is not safe for Internet exposure. Changes
  to SSH, secrets, DNS, external services or public ingress
  require a specific reviewed owner action.

See [target architecture](TARGET_INFORMATION_ARCHITECTURE.md),
[module contracts](MODULES.md) and
[implementation plan](DEVELOPMENT_PLAN.md).

## Android & Shizuku MVP — implementation sprint (2026-11-09)

Owner priorities: P0 direct browser operations, Android apps and CPU/processes;
P1 services/permissions/settings, Advanced Shell 2.0 and diagnostics. These
capabilities are built on the existing private-LAN → Termux →
Android-loopback Companion → Shizuku Binder path, with no pairing or
second-phone confirmation. Actual Android ADB/root UID governs every action.

Source includes app launch/stop/enable/disable/uninstall-for-user-0, named
permission grants/revokes, PID TERM, service start/stop, brightness/timeout,
fresher sampled process inventory, per-app process-name resource summaries,
sortable processes and CPU session history, separate shell stdout/stderr,
exit status, duration and command rerun, and a diagnostics view with the
real Android UID, capability report and endpoint latency.

The source is **not automatically installed or live**. The exact-source
Samsung UI/backend gate, native Android Gradle build/install, guarded
PocketHost-only panel refresh and physical operation/denial matrix must be
reported separately with actual terminal results. Do not declare full MVP
PASS from source commits. See
[Shizuku MVP sprint checkpoint](checkpoints/2026-11-09-shizuku-mvp-sprint.md).


## New product direction: Shizuku power-user integration — 2026-11-08

The owner wants **full available Android control** from within PocketHost,
not an artificially restricted monitoring-only application.
The installed Shizuku manager and authorized Mac ADB have been
observed on Samsung Android 16; Mac ADB returned a genuine
`dumpsys cpuinfo` total (31% in a one-time sample).
This is *not* a live PocketHost Shizuku bridge.

The first implementation slice is `/shizuku` in the UI and a shared
typed capability model. Work evolves incrementally:
1. Real service-running/ADB-vs-root mode/authorization status, native
   Shizuku client companion and first CPU/process readings.
2. Installed apps, permissions, Android process/service diagnostics,
   running apps and system settings; actionable tools, not fake badges.
3. Power-user package, service, process, permission and device
   operations including explicit advanced shell where actual Android
   privileges allow. Expose actual errors rather than artificial bans.
4. Integrated local UX, task lifecycle, audit/debug visibility and
   per-device capability discovery. No compulsory full-suite QA per
   tiny DEV edit.

True root-only operations remain unavailable in ADB mode unless the
device actually has root. Do not broaden LAN/remote exposure or perform
hidden actions. The owner authorizes development of these capabilities,
not silent execution of destructive operations on unrelated processes.
[ADR-0013](adr/0013-shizuku-power-user.md) and
[Shizuku module](modules/shizuku.md) are the canonical spec.


## UX/Architecture — Termux-first source candidate

The owner chose Termux system management as the primary product identity.
Hosting is a separate section. Standalone module routes and one visible
File Manager are implemented as a new source candidate. Samsung exact-SHA
G2, Chrome interaction and independent G3 release gates remain OPEN.
See [UX checkpoint](checkpoints/2026-11-08-ux-architecture-main-menu.md).

## Current milestone: H3.4 accepted with physical follow-ups

H3.4 source `cc9f47a` passed complete Samsung G2;
the `e1c11e7` panel-only G3 cutover preserved
two user sites and six protected services. The
postdeploy physical smoke later failed at the
Restic backup stage. Disposable restore, ttyd
session, registered test-service operation and
real browser interactions are not all accepted.
The general audit adds a small Restic regression
fix requiring its own exact-source native gate.
See [audit checkpoint](checkpoints/2026-11-07-general-repository-audit-repair.md).

## Historical accepted P3 baseline

Application source `bc5e5539ca4656e59077335b71c0875f967ea859`
passed 101/101 Node and 16/16 UI tests on Samsung;
a separate owned P3 HTTP Publish/Rollback/Stop/Start
cycle passed. This was not production acceptance.

## O1 — Observability: Samsung source and LAN HTTP accepted, Mac browser pending

**Observe and diagnose first; automate only after
separate safety and release gates.**

1. **O1.0 Preflight:** fresh main, Samsung Local Agent,
   prior pending QA receipts, six foreign-service
   invariants and PhotoMap port 8010.
2. **O1.1 Host Monitor:** real CPU delta, RAM, storage,
   battery and network where accessible; service health
   with stale and missing states.
3. **O1.2 Process Inspector:** bounded process trees,
   PID/start-tick evidence, safe resource observations
   and explicit external/unknown/owned classification.
   Never signal discovered processes.
4. **O1.3 Runtime Diagnostics:** sanitized starts,
   crashes, timeouts, orphan suspects, retained
   unknown claims and recovery dry-run decisions.
5. **O1.4 Package Inventory:** read-only Termux,
   Node/npm and Python installed versions and
   available-update metadata where safe.
6. **O1.5 Dashboard:** real metrics, small history
   charts, process status and understandable alerts.
7. **O1.6 Acceptance:** targeted negative tests,
   native Samsung results, exact-SHA `check:all`,
   browser/device evidence and a single checkpoint.

Samsung source `315e063` passed full native QA and 19/19 UI tests.
A guarded deployment verified O1 routes, real GET API and safe
manual LAN management on the phone, preserving six external services.
Later `f0dd506` repaired intermittent LAN O1 502 responses:
Samsung check:all PASS, 3/3 LAN HTTP 200 and preserved services.
See the [502 recovery](checkpoints/2026-11-07-o1-502-live-recovery.md).
Real new-version Mac visual and interactive acceptance remains open.
CPU/battery/network may be inaccessible under Android permissions.
See [live O1/LAN checkpoint](checkpoints/2026-11-07-o1-lan-live-acceptance.md).

Deliver useful vertical slices rather than mock screens.
Use the existing module owners plus the new pure
`observability` aggregation contract.

## Parallel release holds

- P3 real browser Publish/Rollback click, keyboard
  and ARIA acceptance remains unverified after a
  Chromium read-only timeout.
- PRoot detached descendants, uncertain startup,
  orphan recovery and full restore remain unproven.
- PhotoMap live Start/health/Stop is not approved;
  any test on disposable copied data requires
  separate explicit authorization.

## Later product milestones

- **Package & Software CMS:** reviewed update plans,
  dependencies, explicit approvals and safe execution.
  Treat Termux rolling-release upgrades differently
  from app-local dependency updates.
- **Publish MVP:** create, deploy and update a new
  generated site with health, rollback, HTTPS/domain
  workflow and an explicit security model.
- **AI and API:** scoped authenticated capabilities
  integrated with existing Local Agent execution,
  not a public arbitrary shell. Local models and
  AI Calls integration remain optional.

Each milestone requires exact-SHA source and
physical acceptance. See [development plan](DEVELOPMENT_PLAN.md)
and [ADR-0010](adr/0010-read-only-observability.md).

## H1 — Hosting MVP: one owned application, accepted

The current large functional sprint is scoped to the **explicitly registered**
`pockethost-demo` static application only. It adds a browser-driven
Create → Start → HTTP Health → Publish v1/v2 → one-step Rollback →
Restart → Stop flow, a real project inventory entry, process-verified
details, a bounded persistent deployment history and owned runtime logs.

The existing P3 backend, ownership marker, loopback listener and trusted-LAN
gateway are reused. The PhotoMap TEST catalog remains read-only and the six
external services are excluded from every mutation. Imported admin template
routes are retained and labeled as examples.

**Status: accepted.** Samsung G2 passed 115/115 Node and 23/23 UI,
then the guarded Samsung LAN release passed. The owner verified the
core Publish/Rollback flow and hosted v1/v2 pages from Mac Chrome.
The accepted H1 runtime remains the rollback baseline while H2 is
tested. H1 versions are restricted to two built-in HTML documents.

After H1 device acceptance: Package CMS, Termux environment controls,
secure Local Agent-backed AI API, multi-project adapters, arbitrary
code uploads, DNS/HTTPS, PhotoMap release work and autostart are separate
milestones. No current sprint item authorizes any of them.

## H2 — browser-owned multiple static sites: device accepted

H2 provides up to eight independently created static
sites, bounded ZIP/folder imports, individual loopback
ports, immutable releases, one-step rollback and
verified Start/Stop/Restart. It includes HTTP health,
bounded logs, process memory/uptime and local
deployment history. Private-LAN read-only site previews
reuse the existing gateway on port 18879.

**Samsung G2/G3: PASS.** Application source
`750c4b3fba2126647c3b593ae89d108ba2a67206`
passed full native `check:all` (26/26 UI tests).
The guarded H2 cutover created two real sites,
uploaded ZIP and folder bundles, served HTML/CSS/JS,
updated and rolled back a release and verified
service noninterference before cleaning test fixtures.

The next gate is the owner's actual Mac Chrome
interaction with one user-chosen uploaded site.
Device HTTP is not equivalent to owner browser
acceptance. No H2 autoservice, public tunnel, login,
Node/Python backend execution or package installation.

## H2.1 — archive selection and cleanup: source candidate

The owner accepted H2 in actual Mac Chrome with
two independently uploaded, working static sites
and confirmed quick rollback. H2.1 implements
on-demand version inventory with date/size/count,
read-only archived preview, restore of any retained
owned release and one-use rollback to the prior
active release. Archived deletion is explicit and
denies active or quick-rollback targets. The
hosted link spacing was adjusted.

**Source only:** exact-SHA Samsung QA and guarded
live acceptance pending. No user site restart, automatic deletion or migration is permitted.
See [H2.1 checkpoint](checkpoints/2026-11-07-h21-release-manager-source.md).

## H3 — reviewed Termux package/software CMS: next product milestone

Build a constrained package inventory and reviewed
installation/update plan, separate OS package upgrades
from project-local dependencies, require explicit
approval for mutations and prove safe rollback/
failure handling on a disposable owned fixture.
The six existing services stay unmanaged.

## H3 parallel feature branch — Termux Control Center

The isolated `feature/h3-termux-control-center-20261107` branch adds a
working four-tab administration candidate without a password prerequisite:

- **Packages:** reuse native `apt-get`, `dpkg-query` and `apt-cache`,
  including bounded full inventory, available package search, simulated
  install/remove/upgrade plans and user-confirmed execution.
- **Files:** display H2-owned active-release assets and provide a separate
  owned scratch workspace with navigation, text editor, rename, copy,
  import/export (128 KiB) and deletion.
- **Services:** reuse the verified H2 own-site lifecycle and logs. Inspect
  runit services and explicitly register non-protected, exact-target
  services before enabling Start/Stop/Restart/Unregister.
- **Backups:** create, list, integrity-verify, restore and delete H3
  workspace snapshots. Preserve the pre-restore workspace as a sidecar.
  Integrate the installed Restic CLI for encrypted local workspace backup,
  repository checks, snapshot listing, staged restore and forget/prune.
  H2 immutable releases remain version history, not system backups.

All four features are actual source code, not placeholders. No package or
service mutation is run during QA. Six protected Termux services and both
existing user-created sites remain unchanged. The current trusted-LAN panel
has no login, as explicitly requested by the owner. The H3 API uses typed
operations, origin/host checks and explicit per-target UI confirmations
without introducing an authentication requirement.

Independent system-wide or off-device backups, arbitrary Termux directories,
terminal exposure and AI agent API remain distinct integrations to evaluate
after native QA. Do not deploy this branch over the existing live panel
without a separate preservation gate. See the H3 checkpoint.

## H3.4 — Full Termux Administration (G3 deployed; test follow-up)

Owner-authorized continuation adds the full named-root File Manager,
manual single-client ttyd terminal, registered runit service autostart
and bounded logs, Restic HOME/PREFIX system backup with staging Restore,
and the typed Local Agent local-HTTP API adapter. No password setup is
a prerequisite. The trusted LAN and loopback trust boundary remains
mandatory; do not expose the terminal through public ingress.

H3.4 passed native Samsung G2 and its panel-only guarded
G3 cutover returned PASS for `main@e1c11e7`.
The two existing sites and six protected services were
preserved. The trusted-LAN panel now serves `/termux`.
Physical ttyd, disposable Restic recovery and browser
tests remain OPEN; ttyd was absent at cutover. Do not
claim all tools installed or full recovery accepted.

See [H3.4 checkpoint](checkpoints/2026-11-07-h34-full-termux-source.md)
and [ADR-0011](adr/0011-h34-termux-administration.md).

## H4 — authenticated agent API: later milestone

Extend the existing Local Agent transport with a
scoped, authenticated local API only after
threat modeling, identity, rate limits and audit
contracts. Do not expose an unrestricted shell.

See [H2 checkpoint](checkpoints/2026-11-07-h2-static-hosting-source.md)
and [development plan](DEVELOPMENT_PLAN.md).
