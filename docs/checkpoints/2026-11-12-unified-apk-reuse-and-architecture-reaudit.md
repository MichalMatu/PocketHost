---
status: evidence-led-design-reaudit-device-validation-open
owner: core
last_reviewed: 2026-11-12
purpose: Review the one-APK Basic/Pro direction, reuse options, code reality and Android hazards
---

# Unified PocketHost — reuse and failure-mode re-audit

## Review boundary

- Source at `ec2ed2a5da4b4bba52a49b420c95ea85816d2dd1`.
  The Git tree contained 618 blobs. Reviewed architecture and
  scoped rules, native Java/manifest/Gradle, Shizuku browser
  components, representative host and Node project adapters,
  security docs, previous local test receipts and official
  upstream repositories. Not a line-by-line proof of all files.
- Review is read-only relative to the physical host: no APK,
  new Termux, app install, process restart or workload migration.
- A previous Samsung `d41ff80` G2 attempt passed 295/295
  Node tests then stopped at an MD012 Markdown issue.
  The later Basic/Pro ADR task passed doc links and Markdown
  lint but failed Prettier for ADR-0015 and ADR-0016.
  No new full source or Android release PASS is claimed.

## Current code worth preserving

- Existing React `/shizuku` page already exposes
  Android application details, processes, services,
  remote shell and diagnostics. Keep one web control plane.
- Existing Java Companion: `MainActivity.java` (~532
  lines), `TelemetryForegroundService.java`,
  `TelemetryHttpServer.java`, `TelemetryProvider.java`
  and `PowerUserService.java` implement native status,
  telemetry, Binder/Shizuku and direct owner commands.
  Its full native screen is transitional, not a second
  permanent settings application.
- Existing Termux hosts implement package preview/apply,
  fixed tool inventory, file roots, Restic and runit
  service administration. Node project source staging,
  ownership checks, runit plans and H2 rollback exist.
  Reuse these contracts; no second package manager,
  backup engine or supervisor.
- `NodeProjectHost` explicitly does not install npm
  packages, bind ports or launch projects. M2/M3 source
  readiness does **not** equal a real multi-process G3
  hosting acceptance.
- `apps/admin/src/app/settings/connections/page.tsx`
  includes example local-only account switches. This
  is not the final settings persistence layer; use one
  validated PocketHost web/native capability contract.

## Blocking findings, in priority order

1. **Android execution:** Direct `execve` from writable
   application data is constrained when target SDK >=29.
   Current Companion targets 35; Google Play's new-app
   threshold is API 36 from 2026-08-31. Any selectable
   runtime must prove its actual process-execution
   strategy and supported Android release policy.
2. **Custom Termux package prefix:** Official packages
   target `/data/data/com.termux/files/usr`. A new
   Android app ID cannot reuse unmodified `*.deb` files.
   An actual fork may need a custom bootstrap, a selected
   rebuilt dependency set and a maintained package feed.
3. **Privilege boundary:** Java loopback listener at
   `127.0.0.1:18791` exposes `POST /shell/run`
   and `POST /action/run` but does not verify the
   client's identity. Loopback and Shizuku's own grant
   do not prove which other Android app made a TCP
   request. The separate read-only ContentProvider
   has UID checks, which do not secure the HTTP route.
   This must be resolved before shipping Pro commands.
4. **Existing LAN panel:** DEV gateway validates private
   subnet, Host, Origin and request metadata but lacks
   genuine owner login/caller authentication. An
   accessible untrusted LAN client is not necessarily
   the owner. Do not expose or call the shell safe
   for general consumers, WAN or shared Wi-Fi.
5. **Shared sockets despite separate UIDs:** Old
   Companion and Termux use 18791, 8787, 18878
   and 18879. New and old APKs share the phone's
   network namespace. Coexistence requires deliberate
   dynamic ports and exact process ownership, not
   killing/stealing an existing listener.
6. **Licensing/distribution:** Termux app, API and Boot
   are GPLv3; relevant Termux libraries have mixed
   component licenses; Shizuku source is Apache-2.0
   with app-name/identifier/asset conditions. GPL
   permits paid distribution but may require sharing
   the corresponding derivative source. Decide the
   product's license before vendoring or designing
   commercial Basic/Pro tiers.
7. **Native build-chain mismatch:** Root repo rules
   require Samsung Termux Local Agent for builds,
   but native-scoped instructions describe a Mac
   SDK build. Earlier read-only Samsung evidence
   lacked Java/Gradle/SDK/ADB/wrapper. Resolve the
   authorized build route, signing and reproducible
   artifact before claiming any APK.

## High-value failure and edge-case matrix

- **Reboot, Force Stop, battery saver, Doze, FGS
  restrictions, OEM background kills:** preserve
  visible real state, user-controlled restart and
  bounded recovery. Boot must never adopt old services.
- **Shizuku revoked, ADB disconnected, Wi-Fi changed,
  wireless pairing port rotated, server killed or
  rebooted:** Pro becomes unavailable, Basic keeps
  hosting. ADB UID is not root and grants are never
  synthesized. Embedded Shizuku is conditional.
- **Offline first launch, signed package mismatch,
  partial install, full disk, interrupted upgrade,
  stale bootstrap, signature/key rotation:** a
  verified installer plan, staged changes and native
  recovery are required; no silent global upgrades.
- **Port clash, PID reuse, symlink escape, unowned
  process, malicious dependency/postinstall hook,
  stopped service, partial backup/restore:** reuse
  current host guards and only launch disposable
  owner-created projects for physical acceptance.
- **Broken web UI or backend, stale cached assets,
  settings schema mismatch:** APK still exposes
  minimal native engine status and recovery. One
  settings store; OS grants remain OS-owned.
- **No independent off-device backup key/data:**
  same-device Restic alone does not guarantee
  recovery after hardware loss. Separate release
  and database rollback mechanisms.
- **16 KiB page devices, app update signature,
  Android scoped storage and app-data UID,
  concurrent legacy/new runtime resource pressure:**
  select build/test targets before release.
- **Android app installed alongside Termux:** data
  UIDs differ but CPU, RAM, sockets, storage and
  network are shared; do not infer isolation of
  system resource exhaustion.
- **Native manifest and docs drift:** Companion
  README still describes the HTTP listener as
  read-only, contrary to current privileged POST
  endpoints. Update security and operator docs
  when the native bridge changes.

## Upstream projects and reuse suitability

- **Official Termux**:
  <https://github.com/termux/termux-app> and
  <https://github.com/termux/termux-packages>.
  Most proven fit for dynamic packages, shell
  and multi-process hosting; costly GPL custom
  package-ID fork. Prefer an upstream-aligned
  narrow package set, not wholesale rewriting.
- **Termux terminal/sharing libraries**:
  <https://github.com/termux/termux-app/wiki/Termux-Libraries>.
  Useful narrow modules and licenses; no need
  to transplant whole native UI into web-first APK.
- **Cortex Terminal**:
  <https://github.com/ssfuisu/cortex>.
  Interesting Apache-2.0 Ubuntu/glibc bootstrap;
  its build currently targets SDK 28, so it
  cannot be assumed Google Play-ready. Young
  project and different host-path conventions.
- **Z2Term**:
  <https://github.com/orgsonai/z2term>.
  GPLv3 one-APK Linux runner and Android APIs,
  currently targets SDK 35 and fetches distro
  on first use. Promising reference for native
  boot, execution and onboarding, not a mature
  drop-in for our offline Basic.
- **UserLAnd**:
  <https://github.com/CypherpunkArmory/UserLAnd>.
  Established PRoot alternative, but changes
  process performance and supervision behavior.
- **Embedded Node.js**:
  <https://github.com/nodejs-mobile/nodejs-mobile>
  and <https://github.com/fogtape/nodejs-mobile>.
  Useful for the panel backend inside an APK
  using a native library; their docs flag
  `child_process.spawn/fork` restrictions,
  so **not** a proven replacement for full
  multi-process Hosting.
- **Shizuku**:
  <https://github.com/RikkaApps/Shizuku> and
  <https://github.com/RikkaApps/Shizuku-API>.
  Keep existing Companion client; only embed
  the server/pairing after a secure prototype
  and actual Samsung permission/reboot testing.
- **Termux:API / Termux:Boot**:
  <https://github.com/termux/termux-api> and
  <https://github.com/termux/termux-boot>.
  Use only relevant Android API and boot
  concepts; existing plugin cross-app APIs
  use signing assumptions and are not drop-in.
- **Web terminal**:
  <https://github.com/xtermjs/xterm.js>.
  Reuse proven MIT UI; does not provide a
  backend PTY. Previous project ttyd device
  SIGSEGV remains a separate physical blocker.
- **Host utilities:** retain official `apt`,
  runit, Restic, cloudflared, existing H2
  releases and one verified service ownership
  policy. See docs/UPSTREAM_REUSE_STRATEGY.md.

## Recommendation: make S1 a true runtime selection gate

The end state remains **one PocketHost APK,
web-first Basic plus optional Pro**. However,
do **not** pre-approve a complete Termux fork.

Compare only **two or three** narrow prototypes
before deciding: official-Termux-compatible
custom prefix, one independent Linux-in-APK
reference, and optionally embedded Node
for the panel backend (not as a full host).
Every candidate must demonstrate:

1. App ID/UID isolation, Android target policy,
   ABI/16-KiB support and legally usable source.
2. Running **two genuine child Node processes**
   with separate ports and reliable lifecycle;
   no fake hosted app status from one JS engine.
3. A selected tool/package chain that includes
   shell, Node and necessary process/backup
   integrations without changing old Termux.
4. Web-first local entry, native recovery, no
   unauthenticated privileged bridge or public
   shell, and clean old/new coexistence.
5. Clear package/upgrade supply chain,
   source/signature provenance, GPL decision,
   offline first-run requirements and restore.

At S1 closeout, choose **one** runtime, then
create **one** host-layout adapter and continue
S2–S10. If no candidate proves the multi-process
host gate, the full standalone runtime remains
HOLD; continue shared web/Hosting development
on existing protected Termux without faking
one-APK independence.

## Authoritative supporting references

- <https://developer.android.com/about/versions/10/behavior-changes-10>
- <https://github.com/termux/termux-packages/wiki/Building-packages>
- <https://developer.android.com/google/play/requirements/target-sdk>
- <https://developer.android.com/develop/background-work/services/fgs/changes>
- <https://developer.android.com/guide/practices/page-sizes>
- <https://developer.android.com/google/play/app-updates>
- <https://github.com/RikkaApps/websites/blob/master/shizuku/guide/setup.md>

**Status:** source/reuse review only. No
independent APK build or install, no clean
Termux replacement and no native release
acceptance. Existing services untouched.
