# PocketHost S1 independent APK runtime spike

**Experimental only. Not the PocketHost product and not a Node.js,
Termux, Shizuku or Hosting replacement.** This standalone APK tests the
part of Android's executable policy that cannot be proven from inside
`com.termux` itself: can a separately installed app execute two
**its own, APK-packaged** ARM64/Bionic subprocesses from
`nativeLibraryDir` with targetSdk 36?

- Package ID: `pl.pockethost.runtimeprobe`, not `com.termux` or
  `pl.pockethost.companion`.
- The disposable C worker is built as a PIE executable with an
  `.so` name so Android's native-library APK packaging extracts it.
  The Gradle build's `compileOwnedProbeWorker` task uses the
  existing Termux ARM64 `clang` and requires a native ARM64 AAPT2
  build tool override.
- No Shizuku, root, storage, boot, notification, package management,
  LAN listener, authentication or existing PocketHost process access.
- Zero listeners until the owner taps the test button; each test
  worker binds `127.0.0.1` with port zero (kernel assignment).
- The app creates process objects itself, tests two simultaneous
  workers and the survival of one after the other stops, and cleans
  up its exact child Process handles even on failure. Never signal
  an arbitrary PID discovered by a process scan.
- A PASS says **APK-owned native executable** is viable on the test
  device. It says NOTHING yet about executing an Android-compatible
  full Node binary, custom Termux packages or runit/Hosting.
- Do not install automatically. Verify independent UID, signature,
  native ELF architecture, package contents and collision-free ports,
  then request explicit owner-approved physical deployment.

## Build environment (future, not yet verified)

Actual device: Android 16 / ARM64. The existing Termux has `clang`
but initially lacked Java, Gradle, Android SDK/API36 and AAPT2.
Use only an explicitly approved, isolated toolchain workspace;
do not run downloaded setup scripts or global `pkg upgrade`.

Source uses AGP 8.10.1, requiring compatible Gradle 8.11.1+
and Java 17+, plus Android SDK platform 36. Google Maven's
default Linux AAPT2 is x86_64. Point the local build at a
reviewed native ARM64 `aapt2` via
`-Pandroid.aapt2FromMavenOverride=<verified-local-aapt2>`.
Do not commit local paths or build-time secrets.

A successful Gradle build alone is not hardware acceptance:
compare before/after installed package IDs, check distinct UID,
run the test in the foreground, capture its PASS/FAIL output,
and confirm Termux, IleStoi.pl and Local Agent did not change.

See [ADR-0016](../../docs/adr/0016-web-first-basic-pro-unified-product.md)
and [runtime re-audit](../../docs/checkpoints/2026-11-12-unified-apk-reuse-and-architecture-reaudit.md).
