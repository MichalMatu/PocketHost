---
status: accepted-target-implementation-open
owner: core
last_reviewed: 2026-11-12
purpose: Canonical web-first Basic/Pro product decision and sequenced sprint acceptance plan
---

# ADR-0016 — Web-first PocketHost Basic and Pro

## Product decision

**One PocketHost APK, one Android app identity, one launcher, one web
administration panel, one configuration authority, one isolated
Termux-compatible runtime.** Basic and Pro are feature tiers inside
the same installation, **not** separate APKs or different host engines.
This supersedes any assumption that native Companion screens or a
separately installed Shizuku Manager must remain part of the final UX.
It does **not** mean that the unified APK, custom bootstrap, embedded
Shizuku server or independent runtime already work.

### Basic: useful without elevated Android privileges

- Independently installed host runtime, Node.js and owned static/Node
  Hosting, project release/rollback, terminal, files and packages.
- Bounded monitoring, logs, owned services, optional backups and
  explicitly enabled startup of **PocketHost-owned** components.
- Standard Android capability bridge: only permissions available to
  the app itself. Integrate the needed Termux:API-like functions and
  boot behavior **inside PocketHost** where Android permits; do not
  require a second Termux:API or Termux:Boot APK for the final product.
- First-run package inventory and a single plan/review/installation
  path; no background bulk installation or hidden global upgrade.

### Pro: independently optional Android power-user capability

- Reuse the current native Companion implementation, Android API
  telemetry, Shizuku/ADB UserService and the power-user operations
  already exposed by the web UI.
- A Shizuku-compatible embedded privileged server and wireless-debug
  setup are the **target subject to device feasibility**, not a
  present capability. A separate Shizuku installation can remain a
  temporary development adapter until the embedded equivalent passes
  independent device acceptance.
- Real privileges depend on Android, explicit owner actions,
  available ADB/root UID and reboot lifecycle. Pro does not grant
  root, bypass platform permission dialogs, or require Basic to wait
  for elevated access.
- Basic and Pro indicate capabilities, **not** a paid entitlement or
  licensing/payment implementation. Commercial tiers are deferred.

## Web UI first: configuration and interaction ownership

The existing React admin panel is the **single control surface** for
both tiers: setup wizard, packages, hosting, monitoring, API/Boot
preferences, Android information, Companion status, Pro actions,
diagnostics, recovery status and all settings that can safely be
represented as web controls. Preserve current routes and usable
upstream components; migrate existing native Companion controls to
the corresponding web views instead of recreating another settings
tree.

The Android Activity is deliberately minimal: launch/open the local
panel; show genuine engine state; optionally start/stop **its own**
engine; expose recovery when the panel cannot start; and initiate
Android-owned permission, Bluetooth/notification, wireless-debug or
other system dialogs only when unavoidable. Native notification and
foreground-service UI remain system-owned. A broken web UI must have
a bounded native recovery entrypoint. The APK does **not** maintain
a second settings database or second hosting/package manager.

One versioned, PocketHost-owned settings contract holds shared
configuration. Native-only permission grants remain under Android's
authority and are *observed*, not copied or fabricated. The UI
reads effective capability state and surfaces permission gaps and
actions; native services own Binder and lifecycle; the runtime host
owns packages, processes and filesystem. Browser controls never
invoke arbitrary privileged Binder APIs without a reviewed boundary.
A loopback address alone is **not caller authentication**: before
shipping any Pro command bridge, protect privileged actions using
verified caller identity or an equivalent scoped owner-only channel.
Keep the existing owner DEV gateway private and never call it
production-safe.

## Reuse and coexistence boundaries

- Reuse current `apps/admin`, typed APIs, `src/modules/host`,
  Hosting Module/Service/Project registries, H2 owned releases,
  runit, Restic and native Companion source. Refactor one runtime
  path/layout contract to remove hardcoded `com.termux` prefixes
  when custom bootstrap becomes real. No duplicate engines,
  independent supervisors, backup stacks or ad-hoc package tools.
- Build one **new** Android app ID/UID, custom prefix/bootstrap and
  separate private HOME. Official Termux binaries cannot simply
  be copied into another package ID. Check Android executable
  policy, ARM ABI, signing, GPLv3 and dependency distribution
  before shipping or assuming an installed package will work.
- Existing `com.termux`, Termux:API, Termux:Boot, Shizuku,
  PocketHost Companion, IleStoi.pl, PhotoMap and Local Agent are
  retained throughout development. No uninstall, Force Stop,
  migration, package upgrade or service restart is implied.
- One target runtime means one runtime **inside the eventual
  PocketHost installation**. Legacy and test environments may
  coexist during development. Do not label a same-UID workspace a
  separate Termux installation.
- The inherited repo currently requires GitHub Connector for
  source and verified Samsung Termux Local Agent for commands.
  The Samsung native Android build prerequisites were previously
  unavailable; do not claim an APK was built. Resolve any native
  build-toolchain versus repository execution-policy conflict
  explicitly before the build sprint.

## Sequential implementation sprints

Close one sprint with a tested commit, evidence, a narrow
checkpoint and a ready-to-start next item. Do not execute the
following sprint automatically when its gate is not met; repair
the specific blocker first. Testing is proportional to the changed
component; release gates are collected once at an appropriate
milestone. These are **future deliverables**, not completed work.

### S0 — Decision and non-destructive baseline

**Deliver:** this canonical product architecture, explicit
Basic/Pro capability split, web-first UI and this ordered sprint
sequence; link prior ADR-0015 bootstrap decision rather than
duplicating its implementation details.

**Close:** GitHub main contains the decision, no active-device
mutation, documentation links and formatting checked on Samsung.
Known earlier quality-gate failures stay OPEN until resolved.

### S1 — Verified feasibility and execution chain

**Deliver:** exact current repo/QA state and Local Agent receipts;
read-only Samsung app/UID/API/ABI/storage inventory; pin licenses
and upstream source versions; identify Android build/debug
signing method and supported executable bootstrap approach.
Resolve missing SDK/Gradle and conflicting build instructions
before attempting an APK.

**Close:** evidence-backed decision of custom-prefix build,
legal/provenance constraints, independent test installation and
recovery route. Any impossible prerequisite is a HOLD, not a PASS.

### S2 — One capability contract and web settings

**Deliver:** a small Basic/Pro capability/status contract based on
real availability, one PocketHost settings owner and web-based
status/configuration landing page. Move only already implemented
Companion settings/actions into the web panel; do not invent
privileged successes or duplicate native settings. Define native
recovery responsibilities.

**Close:** focused UI/backend tests for absent Pro/denied
permission, settings round-trip, web access without Companion,
and native app remaining a thin launcher.

### S3 — Thin native PocketHost shell

**Deliver:** the new separate app ID, one launcher Activity,
panel entrypoint and state/recovery screen; reuse Companion code
where appropriate, without importing a second manager UI. The
shell must run with the runtime unavailable and must not touch
the existing Companion app.

**Close:** debug APK builds under an approved toolchain,
installs independently, opens its own landing UI and reports
missing backend truthfully. No legacy service interaction.

### S4 — Custom-prefix runtime proof

**Deliver:** pinned Termux-compatible bootstrap for the new
PocketHost app ID and ABI; minimal shell/toolchain executable
under Android's real restrictions, with separate HOME/PREFIX and
single reviewed runtime-layout adapter. Do **not** rely on
`/data/data/com.termux` or borrow that app's filesystem.

**Close:** on-device checks prove distinct UID, executable
prefix, clean package inventory, reboot/recovery and isolation.
No package installs or services outside the new owned app.

### S5 — Offline local panel and backend

**Deliver:** reuse the production React UI bundle and existing
typed host APIs inside the new runtime. Open local PocketHost
panel from the APK with the actual backend state. One
local-only API transport; secure its caller and bind semantics
before exposing host or Pro command actions.

**Close:** first launch works without external Termux or
network, restart restores its own state, failure returns to
native recovery UI, and pre-existing Termux remains unchanged.

### S6 — Basic installer, standard Android APIs and boot

**Deliver:** one first-run wizard for required package inventory,
pinned/checksummed install plans and repair; native replacements
for the **needed** Termux:API-like calls and controlled startup
of only PocketHost-owned services. No copied old Termux boot
scripts or duplicate runit daemon.

**Close:** clean installation and approved optional packages
work without legacy add-ons, cancellation/failure is truthful,
reboot does not start foreign services and Basic runs with
Shizuku unavailable.

### S7 — Basic Hosting end-to-end

**Deliver:** connect existing owned static site and one
disposable Node.js project flow to the embedded runtime.
Preserve M2/M3 service ownership, package plans, logs,
health, restart policy, releases and rollback; implement
only missing integration gaps, not a second hosting stack.

**Close:** web Create/Start/Update/Rollback and failure recovery
pass on the separate app UID with a disposable project. Existing
IleStoi/PhotoMap/Local Agent stay untouched.

### S8 — Pro web controls and trusted native bridge

**Deliver:** integrate current Companion Android telemetry and
privileged operations as a Pro capability inside the same APK.
The existing native Companion UI becomes a minimal internal
bridge, not a duplicate configuration panel. Privileged
endpoints must verify actual caller authority; absence,
revocation and restart are visible in the web panel.

**Close:** unauthorized callers are rejected; authorized
explicit operations work at actual granted UID; disabling or
crashing Pro never interrupts Basic or Hosting.

### S9 — Embedded Shizuku feasibility and transition

**Deliver:** evaluate a narrow, licensed Shizuku-compatible
embedded server/bootstrap and optional wireless-debug
pairing UX. Adopt only the upstream portions actually needed.
Keep the standalone Shizuku adapter available during
development until equivalence is verified; do not copy the
Shizuku app ID, trademark assets or protected permissions.

**Close:** real Samsung ADB/root-permission and reboot
acceptance, repeatable start/recovery, no external Manager
dependency for accepted features. If platform restrictions
prevent this, retain an explicit Pro external-dependency
fallback and do not delay Basic release.

### S10 — Unified release candidate and optional migration

**Deliver:** fresh-install APK with one launcher, web-first
settings, Basic and optional Pro; close relevant source,
security, licensing, backup/restore, clean-device and hardware
quality gates. Record source and APK hashes and safe uninstaller
behavior. Migration/import of old owned data is separately
owner-opted and **never** automatic.

**Close:** user-visible first-run/upgrade/reboot/failure/restore
acceptance and confirmed lack of impact on the original
Termux/services. Removing the original apps is **not** part of
this sprint; consider it only after full replacement proof and
explicit owner decision.

## Progress accounting

Start at **S0: decision/source documentation only**.
S1–S10 are OPEN. Mark completion only with source SHA,
target device/build identity, terminal test receipt and
physical gate where required. The current repository
quality record and the old Android Companion build history
are not proofs of a unified PocketHost APK.

Related decisions: [ADR-0015 runtime/bootstrap](0015-unified-android-app-isolated-runtime.md),
[Architecture](../ARCHITECTURE.md), [FAST FLOW](../DEV_ITERATION.md),
[Roadmap](../ROADMAP.md) and [quality gates](../QUALITY_GATES.md).
