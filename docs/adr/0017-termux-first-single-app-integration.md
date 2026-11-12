---
status: accepted-implementation-open
owner: core
last_reviewed: 2026-11-12
purpose: Canonical single PocketHost application built from existing Termux and Android components
---

# ADR-0017 — Termux-first unified PocketHost

## Owner decision

**One user-facing PocketHost Android application** with one web administration
panel, existing Termux command/package environment, Android integration from
PocketHost Companion, relevant Termux:API and Termux:Boot functions, and
Shizuku power-user integration. Reuse the upstream implementations rather
than writing a new shell, SSH, Git, Node.js, package manager, process
supervisor, Linux runtime or a second hosting backend.

This is a **target**, not a statement that a one-APK product already
exists. The current DEV panel and Node host run in the installed Termux;
Companion and Shizuku are currently separate Android components.
ADR-0015 and ADR-0016 are superseded. Their standalone S1/S2 runtime
path and sprint numbering are no longer product work.

## Code ownership and reuse

- **Android APK foundation:** start from a pinned, licensed upstream
  [termux-app](https://github.com/termux/termux-app) fork. Preserve
  Termux's terminal/session implementation, bootstrap, native process
  model, package-prefix assumptions and official package ecosystem.
- **Host runtime:** retain official Termux packages and existing
  pkg/apt/dpkg, Git, OpenSSH, Node.js, Python, runit, Restic and
  cloudflared where supported. Do not build replacements or a competing
  package repository.
- **PocketHost web/backend:** preserve apps/admin, typed contracts,
  src/modules/host, H2 releases, M0–M7 hosting roadmap, service ownership
  checks and bounded runit adapter. Package the existing UI and Node
  backend through a reviewed first-run launcher, not duplicate servers.
- **Android functions:** migrate and extend current
  native/pockethost-companion Java services into the app's Android layer;
  reuse selected upstream
  [Termux:API](https://github.com/termux/termux-api) Java components and
  command-side APIs after checking permission, IPC, signature and license
  boundaries. Keep the existing termux-* caller contract when possible.
- **Boot:** adapt needed
  [Termux:Boot](https://github.com/termux/termux-boot) receiver behavior
  for explicitly owner-enabled PocketHost-owned components only.
  Android background/foreground restrictions and reboot acceptance apply.
- **Shizuku:** retain existing Shizuku client, Binder/UserService and
  real authorization handling. Reuse upstream
  [Shizuku](https://github.com/RikkaApps/Shizuku) where compatible.
  A single-APK server/pairing solution is a separately tested feasibility
  gate; no embedded code can silently grant ADB or root privileges.
  The standalone Manager is a DEV adapter until a proven replacement.

## Critical Android integration constraints

The official Termux package ecosystem assumes the com.termux package
identity and its absolute private filesystem prefix. Changing app ID
means rebuilding affected packages for a new prefix: this is **not** an
acceptable invisible shortcut. Prefer keeping the upstream identity and
prefix for an integrated build, but an APK signed with a different key
cannot update the existing official Termux install. Such a build is not
installable side by side under the same package ID in one Android profile.
Choose a spare test device/profile or other safe isolated target before
installation; do not replace the active host just to test packaging.

The installed Termux with IleStoi, PhotoMap, SSH, cloudflared,
Local Agent and PocketHost DEV services is protected. No automatic
migration, overwrite, reboot, package upgrade or uninstall.
Keep native target-SDK execution restrictions, Android permissions,
16-KiB page support, upgrade signing and backup/restore as explicit
acceptance gates. Combining Termux GPLv3 code with the app requires a
documented distribution license and corresponding source/notices.
Do not promise a Play Store release before policy/licensing feasibility.

## Implementation order

1. **I0 — source cleanup and baseline:** retire the unrelated standalone
   runtime probe, fix documents and protect existing services; no deployment.
2. **I1 — integration seam:** map current Termux/Companion APIs, one
   capability/status contract, authenticated owner-specific cross-app
   transport where privileged actions are involved, one web settings
   owner and focused negative tests. Preserve running DEV behavior.
3. **I2 — Android functions:** reuse the existing Companion Java source,
   adapt selected Termux:API functionality and Boot logic in a test
   integration, verify permissions, command compatibility and lifecycle.
4. **I3 — single APK assembly:** import pinned termux-app as the APK
   foundation, integrate the web bundle/backend and Android modules.
   Prove bootstrap and package compatibility on a disposable target,
   without altering the original installed Termux.
5. **I4 — device acceptance:** test real Node/SSH/Git/pkg/runit and
   PocketHost hosting end-to-end, app updates/reboot/restore, Shizuku
   availability and denied permissions, API/Boot and no impact on
   protected workloads. Migrate only with an explicit owner opt-in.

M0–M7 in the [roadmap](../ROADMAP.md) continue independently as
the existing Hosting functionality plan. No duplicate host, installer
or package manager. A passing ARM64 subprocess spike is not completion
of any of the integration stages above.

## Present state

**I0 in progress; I1–I4 OPEN.** No unified APK or embedded privileged
Shizuku server has been demonstrated. Development commands/builds/tests
are dispatched only through the Samsung Termux Local Agent under
[AGENTS](../../AGENTS.md); source changes use GitHub Connector.
