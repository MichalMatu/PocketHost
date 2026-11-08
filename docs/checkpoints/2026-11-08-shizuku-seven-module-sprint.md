---
status: source-candidate
owner: shizuku
last_reviewed: 2026-11-08
purpose: Record source scope, test evidence, security boundaries and hardware hold for seven Shizuku areas
---

# PocketHost — Android & Shizuku seven-area sprint

## Baseline and source

- Started from fresh `main@32e25c8d03e2ed46b78d75520b08d7b9ae6d6a95`.
- Existing native telemetry was accepted through `main@00010ada`, with
  CPU samples and a working foreground service on the physical Samsung.
- Source-only incremental commits:
  - `be91f5c`: Android system overview, typed Binder commands and read-only `/system`.
  - `7f075e2`: six native Companion action sections, local confirmation.
  - `d84531a`: six functional web sections, contracts and docs.
  - `c3a3e8e`: separate slow inventories from CPU refresh, honest process errors.
- New source must not be described as the installed Android APK until physical installation is verified.

## Seven areas

1. **Applications:** the web UI searches up to 1024 Shizuku-visible packages and
   marks user/system type. Native Companion offers an exact package detail
   lookup (version, target SDK and observed granted runtime permissions),
   owner-confirmed launch, force stop and uninstall for Android user 0.
2. **CPU & processes:** Android-wide CPU from the existing bridge, plus
   structured PID, name, owner, RSS and per-process CPU when supported by
   Android `ps`. Native process TERM is targeted by exact PID and confirmed.
3. **Permissions:** per-package inspection and explicit permission
   grant/revoke with Android permission checks. The OS may refuse.
4. **Services & settings:** bounded Android service component sample,
   current brightness and airplane mode, owner-confirmed service
   start/stop, screen brightness and timeout changes.
5. **Advanced shell:** the physical Companion only can send a confirmed
   owner-entered shell command through its Shizuku UserService. Command
   length is bounded to 240 characters; output and runtime are bounded.
6. **Power & hardware:** native battery level, charging state, battery
   temperature, total and available Android RAM. Unavailable fields remain null.
7. **UX/UI:** six separate modules replace the static future-capability
   cards; responsive section navigation, search, owner notices,
   real observed timestamps and unavailable states. The Termux
   monitoring section remains separate.

## Trust and implementation boundaries

- The trusted-LAN web dashboard has no login or verified owner identity.
- All web Shizuku endpoints are fixed **read-only GET** requests through
  Termux to the Companion's loopback 127.0.0.1 port 18791.
- No API accepts arbitrary shell text, app mutation, package deletion,
  permission changes, service changes or PID signals over LAN.
- The only Binder mutations originate from the native PocketHost
  Companion UI after owner-visible target/action confirmation.
- Shizuku ADB mode is not root, and Android-specific refusals are
  reported rather than bypassed.
- No existing Termux, IleStoi, Local Agent or PhotoMap service is a
  permitted implicit operation target.

## Verification

### Completed evidence

- Exact `7f075e2` native Android Java/AIDL build and debug APK packaging:
  Mac Local Agent task
  `pockethost-shizuku-sprint-native-compile-7f075e2-20261108-v1`
  returned `done/0`, `BUILD SUCCESSFUL`, 73,279-byte APK.
  SDK/annotation warnings remain and should not be confused with build errors.
- The previous `c7d5587` app-inventory contract check on Samsung Termux
  passed three Node tests and three Vitest cases; later full QA for
  this sprint is separate. Its lint failure was repaired in `32e25c8`.
- At the last read-only Mac ADB diagnostic,
  `pockethost-adb-target-availability-readonly-20261108-v2`,
  `adb devices -l` found **zero** attached devices.
  Therefore no current Companion APK installation or Android action
  acceptance can be asserted.

### Open exact-source gates

- Rebuild final native source `c3a3e8e` or later; verify the APK signature.
- Final-SHA Samsung Termux Node tests, Vitest Shizuku contract, admin lint,
  TypeScript check, build, structure/docs/boundaries.
- Focused formatting improvements; repository-wide existing formatting
  warnings are tracked separately from functional gates.
- Reconnect one unambiguous Samsung SM-S906B via ADB, then install the
  exact built APK without changing other device packages.
- Native positive/negative matrix on disposable app/component:
  app inspection and launch; deliberate denial cases for package
  stop/uninstall and grants; process listing; Android settings;
  service refusal; shell output and a failed command; active/expired
  telemetry; CPU updates while slow inventory is running.
- Validate browser `/shizuku`, `/api/v1/shizuku/status`,
  `/api/v1/shizuku/apps`, `/api/v1/shizuku/system`
  on the trusted LAN after the exact source is synchronized.
- Confirm unauthenticated LAN cannot invoke any Shizuku mutation route.


## Physical read-only acceptance (2026-11-08, source 80c15b5)

The Mac Local Agent targeted exactly one Samsung SM-S906B, installed the
signed PocketHost Companion debug APK (108,429 bytes) with \`adb install -r\`,
and launched that Companion package only. A corrected read-only Mac SSH
probe from Samsung Termux returned terminal \`done/0 PASS\` in
\`pockethost-shizuku-native-device-readonly-smoke-80c15b5-20261108-v2\`:

- \`GET /status\`: HTTP 200, authorized Shizuku ADB, 22% CPU, 871 visible processes.
- \`GET /apps\`: HTTP 200, 550 packages, \`truncated=false\`.
- \`GET /system\`: HTTP 200, 871 detailed process entries,
  \`truncated=false\`, no process sampling error, battery level 100%,
  Android available RAM 2,915,032 kB.
- Android services sample contained 0 names; this is **not** a pass for
  the actual services inventory. The diagnostic is under investigation.

The physical negative mutation matrix, permission grants/refusals,
service control acceptance, native shell action confirmation and
new browser/Termux backend synchronization remain OPEN. This physical
receipt covers read-only telemetry, **not** every feature in the sprint.

## Rollback and next handoff

Do not reinstall an untested APK, disable existing phone services or
publish an unrestricted LAN shell. If a source regression is found,
revert only the affected PocketHost commits on `main` without force
push; the installed prior Companion and verified CPU bridge remain
the stable fallback until a guarded device-level re-test passes.
Continue from current `main` HEAD, never from these historical SHAs.
