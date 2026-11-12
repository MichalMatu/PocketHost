---
status: accepted-with-feasibility-gates
owner: core
last_reviewed: 2026-11-12
purpose: One-app packaging decision and an independent clean Android runtime acceptance path
---

# ADR-0015 — Unified PocketHost APK and isolated Termux-compatible runtime

## Decision

The owner wants **one main PocketHost Android application**, containing the
existing React interface, native Companion/Shizuku capabilities and a
PocketHost-owned Termux-compatible host runtime. Development proceeds on
**two coordinated tracks**: the Android packaging/isolation foundation and
the existing Hosting M2/M3 modules. Neither track replaces a working host
adapter, package manager, process supervisor or release engine with a
duplicate. This ADR extends the one-app target already recorded in
[Architecture](../ARCHITECTURE.md).

The preferred end state is **one installed PocketHost APK** with a separate
Android application ID, UID and private data, not an update to
`com.termux` or the currently installed Companion. Its minimal boot
environment must start the local UI/backend offline; optional Hosting
capabilities may use an explicitly user-approved installer from pinned,
verified packages. Reuse the existing Node, runit, Restic, site-release,
registry and typed API boundaries. Shizuku Manager remains a separately
authorized Android facility, not an APK-bundled root privilege.

## Technical feasibility gates, not yet a working package

- Upstream Termux binaries, scripts and Debian packages assume
  `/data/data/com.termux/files/usr`. A fork with a different Android
  application ID requires a matching **custom bootstrap and rebuild of
  required packages for that exact prefix**. The official compiled
  `com.termux` packages cannot be reused as-is. A second installation
  under a work/secondary profile does not solve that prefix requirement.
  Reference: [Termux forking](https://github.com/termux/termux-app#forking)
  and [package builds](https://github.com/termux/termux-packages/wiki/Building-packages).
- The native Companion currently targets Android SDK 35. Android 10+
  app-data execution restrictions for target SDK 29+ complicate an
  embedded mutable executable prefix. **Prove a supported execution
  mechanism on the actual Samsung before choosing target SDK, APK
  packaging or installer behavior**; do not silently lower the existing
  Companion's target.
- The Termux application is GPLv3. Before incorporating its code,
  determine source-distribution obligations, compatibility with the
  final PocketHost license, included third-party notices, package
  provenance and signing. A root license decision is still required.
- Current PocketHost host adapters contain absolute `com.termux` paths.
  Create **one** reviewed runtime-layout contract at the integration
  boundary when the custom bootstrap is selected, then migrate callers
  with targeted tests. Do not add an unused parallel host implementation.
- `proot-distro` or a second project directory under the current
  Termux can be a disposable test workspace, **not** a separate Android
  UID, an independent Termux install or sufficient isolation evidence.
  An emulator/second device can test fresh setup without risking the
  active phone, but does not substitute for final same-device acceptance.

## Work sequence — packaging track

1. **Read-only host preflight:** identify Android API/ABI, current
   installed app IDs, package/build tools, free space, ownership and
   available clean test targets. No installs or lifecycle operations.
2. **Standalone bootstrap proof:** pin upstream sources and licenses;
   build one minimal custom-prefix boot environment and a debug APK
   using a disposable build workspace. Use a different application ID
   and debug signing identity. Do not reuse `com.termux` signatures,
   package paths or installed data.
3. **Independent-device proof:** install alongside the original Termux
   and Companion, confirm a separate UID, private `HOME`/`PREFIX`,
   minimal executable toolchain, clean package inventory and no
   dependency on original Termux data. Verify uninstall/rollback only
   removes the new owned app data.
4. **One-app integration:** incorporate the existing React production
   bundle and native Companion, plus a narrowly scoped host bridge.
   Select a single owned runtime supervisor, API transport, offline
   bootstrap and optional capability package plan. No duplicate
   package managers, no hidden Shizuku access, no WAN admin listener.
5. **Clean acceptance:** fresh install without previous Termux state,
   first-run package verification, owned Node project creation,
   readiness, logs, backup/restore staging and rollback. Verify active
   Termux, Local Agent, IleStoi, PhotoMap and foreign services are
   unchanged before and after. Record exact APK/source hashes.

## Work sequence — Hosting track

Continue only shared, already present M2/M3 contracts: ownership,
runtime health, dependency plans, release/rollback, diagnostics and
disposable project tests. Keep the browser UI and backend operational
on existing Termux in DEV. Defer broad package-installation UI,
auto-provisioned external services, duplicate backup/SSH/Cloudflare
systems and migration until the new prefix and installer are proven.
The installer owns *what is installed*; Hosting owns only explicitly
created projects; native Android owns permission/Companion actions.

## Non-negotiable acceptance

No action may uninstall, upgrade, clone, overwrite or restart the
current `com.termux`, Companion, Local Agent or foreign services.
No root, Shizuku grant, LAN/public exposure or success is inferred from
a Git commit or task publication. A test on a shared UID is marked
**same-UID test**, never **independent instance**. Current status:
**DESIGN ACCEPTED / CUSTOM APK NOT BUILT / ISOLATED ANDROID INSTANCE
NOT INSTALLED**. See the repository's [quality gates](../QUALITY_GATES.md).
