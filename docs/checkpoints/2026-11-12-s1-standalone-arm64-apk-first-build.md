---
status: retired-historical-evidence
owner: core
last_reviewed: 2026-11-12
purpose: Exact-source S1 standalone APK build evidence and remaining native isolation gates
---

# S1 — standalone ARM64 APK first successful build

**Retired from product plan.** This records a disposable probe, not an
accepted PocketHost runtime or the next development sprint. The original
build-day OPEN statements below are historical snapshots; current product
architecture is [ADR-0017](../adr/0017-termux-first-single-app-integration.md).

**Later physical evidence:** the owner confirmed installing and running
the separate probe APK and reported PASS for the two ARM64 subprocesses.
Samsung Local Agent read-only package UID task
pockethost-s1-installed-apk-uid-readonly-20261112-v1 completed with
PASS_DISTINCT_UIDS: com.termux=10520, Companion=10077, probe=10749.
This is only APK process/UID isolation, **not** Termux/Node/package
integration. It does not establish unchanged foreign service state.
The test APK remains owner-managed on the device; code cleanup does
not uninstall it.

## Scope and source

- **PocketHost source:** `fd69447d39ca16a3761c3fb235a6e572fffc681b`.
- **Samsung target:** SM-S906B, Android 16 (API 36), arm64-v8a.
- **Test application:** `pl.pockethost.runtimeprobe`, separate
  from `com.termux` and `pl.pockethost.companion`.
- **Purpose:** determine whether a separately signed Android APK
  can execute two APK-owned native/Bionic children on distinct
  loopback ports. This is deliberately **not** a Node.js-in-APK
  or complete custom-Termux proof.

## Completed evidence

- Prior focused Samsung test of two Node children in **existing
  Termux UID**: 2/2 PASS (not an independent APK proof).
- Current Samsung `clang` compilation of disposable ARM64
  `probe_worker.c`: PASS; focused docs and Prettier PASS.
- Samsung OpenJDK 17.0.21 and native AAPT2 installed following
  explicit simulated dependency approval: 8 new packages,
  one update of `ca-certificates` from `1:2026.11.05` to
  `1:2026.11.05-1`, zero removals. No global upgrade.
- Official Android CLI and Gradle 8.11.1 archives were
  SHA-256 checked and staged under the owner's private
  `pockethost-s1-toolchain` workspace.
- On-device Local Agent terminal receipt
  `pockethost-s1-sdk36-standalone-debug-apk-after-toolchain-20261112-v4`
  reports **APK_BUILT_NOT_INSTALLED**. SDK platform 36 and
  Gradle `:app:assembleDebug` completed (35 actions, BUILD
  SUCCESSFUL); Termux-native AAPT2 override was used.
- Output in that private workspace:
  `pockethost-s1-runtimeprobe-fd69447d39ca.apk`.
  **Size:** 20,975 bytes.
  **SHA-256:** `8dbcbb70204057137e4ad967f1165961d79fdaae28c8e0639fa7dadc27652729`.

## Remaining validation at the time of this first build (historical)

1. Read-only artifact verification: exact ZIP/hash, Android manifest
   package ID, min/target SDK, debug signature, native ELF AArch64,
   16 KiB LOAD alignment, only expected permissions, existing-app
   coexistence snapshot. Local Agent task
   `pockethost-s1-built-apk-artifact-security-preflight-20261112-v1`
   was published; a terminal receipt is required before marking PASS.
2. **No APK installation has occurred under this sprint evidence.**
   Do not automatically install from a source commit or build PASS.
   Physical installation needs explicit approved deployment, a
   verified unique app identity, exact hash and owner-visible
   package-installer consent as required by Android.
3. Run the isolated test from its own Activity, verify independent
   UID, child PIDs, distinct kernel-assigned loopback ports,
   stop-one/survive-other/restart; verify its own cleanup.
4. Confirm original Termux, Companion, IleStoi.pl, PhotoMap and
   Local Agent services have no changed state or ownership.
5. Even an APK native-children PASS does **not** prove a
   packaged Node executable, package manager, runit, Restic,
   automatic startup or embedded Shizuku. Those remain
   separate feasibility gates before selecting the Basic runtime.

## Non-blocking build warnings

- AGP reported an explicit `android:extractNativeLibs`
  manifest attribute warning; packaging is also controlled
  by the Gradle `useLegacyPackaging` setting.
- SDK manager emitted mixed XML schema-version warning.
- Gradle could not strip the disposable `libpockethost_probe.so`
  symbol metadata and packaged the binary unchanged.

**Acceptance:** S1 source and first build **PASS** at the
specified SHA; artifact security, installation, actual
separate-UID process execution and complete runtime **OPEN**.
