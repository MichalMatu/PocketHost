---
status: source-implemented-hardware-validation-open
owner: shizuku
last_reviewed: 2026-11-09
purpose: Track the P0/P1 Android Shizuku MVP sprint, safe physical acceptance and exact-source evidence
---

# PocketHost — Android & Shizuku MVP sprint

## Product decision and implementation sequence

1. **P0.1 Direct browser action API.** Reuse the exact owner-private LAN gateway, Termux
   loopback backend and Companion foreground Shizuku Binder. Strict typed targets and
   bounded IO prevent accidental route/argument ambiguity, not Android feature classes.
   No pairing code, phone approval queue, product permission caps or invented root.
2. **P0.2 Applications.** Launch, force-stop, enable, disable, uninstall for Android user 0,
   package metadata and permission detail; searchable user/system inventory and
   process-name-matched memory/CPU observations (not fabricated app attribution).
3. **P0.3 Processes.** 15-second in-tab refresh of real status/process samples,
   30-second native system sampling, session-only CPU chart, PID/name/user/RSS/CPU
   sorting, exact selected PID and explicit TERM.
4. **P1.1 Services, permissions and settings.** Permission grant/revoke next to the
   selected permission, service start/stop for an observed component, actual Android
   brightness and screen timeout read/set. Android refusals remain visible.
5. **P1.2 Advanced Shell 2.0.** Direct shell, bounded stdout and stderr as separate
   streams, real exit code, execution duration, copy output (including HTTP clipboard
   fallback), 10-entry tab-local history and rerun. No command category allowlist.
6. **P1.3 Diagnostics.** Real Binder-reported UID and ADB/root mode, authorization,
   capabilities, independent status/apps/system request durations and failures.

## Source and trust boundary

Commits after the accepted direct shell baseline `1861856` implement the above
in `native/pockethost-companion`, `src/modules/host` and `apps/admin`.
The current commit must be retrieved from `main`; do not assume this checkpoint
is a release SHA.

- Native loopback stays `127.0.0.1:18791`; PocketHost DEV serves private-LAN
  admin `18878` through existing origin/host enforcement.
- Android action POST `/api/v1/shizuku/action/run` maps to native
  `/action/run`; the previously accepted direct shell remains separate at
  `/api/v1/shizuku/remote-shell/run`.
- No new public interface, Android boot receiver, persistent Termux service,
  second Companion or Local Agent modifications.
- Private-LAN HTTP access is deliberately unauthenticated and unencrypted in
  this owner-requested DEV phase. Do not claim this is safe for WAN.
- Actions run only after a user click; no background mutations. Sampling and
  diagnostics are read-only.

## Acceptance checklist

- [x] Fresh source HEAD, relevant AGENTS and existing physical evidence reviewed
- [x] P0/P1 source implementation and Node/Vitest regression coverage added
- [x] Targeted Samsung first-pass backend contract: **16/16 PASS** at
  `0b8aaa2`; original UI batch: **12/13 PASS**; failed assertion checked exact
  string equality instead of substring (test repair in later source)
- [ ] Exact current `main` Samsung Node and UI suite, lint, TypeScript and Vite build
- [ ] Native Companion compile from exact current source, signed APK verification
- [ ] Guarded install of only the matching Companion on the exact Samsung
- [ ] Guarded PocketHost-only DEV refresh and LAN positive/negative API tests
- [ ] Harmless `id`, `whoami`, shell nonzero exit/stdout/stderr/timing
- [ ] Application inventory, package details and safe *refusal* tests on nonexistent target
- [ ] Verify CPU/history/PID/read-only service, permission and setting snapshots
- [ ] Optional actual mutation matrix only on an explicitly disposable test target;
      do not act on unrelated real apps, services, processes or user settings
- [ ] Owner Mac browser UX checks and full final `check:all`

A missing build tool, absent device, stale source or unconfirmed response is **OPEN**,
not success. The native compiled test, actual installation and browser display are
independent physical gates.

## Existing observations

Samsung Termux Local Agent read-only preflight
`pockethost-shizuku-mvp-preflight-20261109-gpt6-v2` returned
`done` with available Git/Node/npm, verified clean QA and DEV
checkouts and correct PocketHost origin.

The first exact-source targeted Samsung QA
`pockethost-shizuku-mvp-source-qa-0b8aaa2-20261109-gpt6-v1`
confirmed 16/16 Node contracts; UI 12/13, with only a test assertion
wording issue, corrected in subsequent source. It did **not** run lint
or Vite build after its first failure.

Initial Mac native compile attempt used an obsolete Gradle wrapper cache
path and failed before compiling Java. Read-only Mac inventory
`pockethost-shizuku-mvp-mac-gradle-inventory-20261109-gpt6-v1`
found existing Gradle 8.11.1 **all** distribution and SDK. Rebuild
must select the actual existing tool; no global install.

## Rollback and next steps

Do not mutate current production sites, PhotoMap or six protected Termux
services. Verify exact owner process identity before refreshing PocketHost DEV;
capture matching previous Companion APK before any reinstall. Revert only
PocketHost source if source tests fail; rollback targeted APK/panel if native
deployment fails. Preserve current live panel until guarded cutover passes.

After exact-source quality, run Mac native build, then hardware smoke on
one Samsung, then protected-service inventory and owner's Chrome review.
Security hardening/TLS/authentication is the separately requested final stage.
