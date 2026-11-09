---
status: dev-live-shell-pass
owner: shizuku
last_reviewed: 2026-11-09
purpose: Direct power-user browser shell without pairing or confirmation prompts
---

# PocketHost — direct Advanced Shell, owner decision 2026-11-09

The owner explicitly rejected the pairing code, approval queue and repeated
native confirmation in the first browser-shell candidate. These were
unnecessary UX blockers for PocketHost DEV.

## Contract

- Browser Android & Shizuku → Advanced shell → **Run on Samsung**.
- Exact command is sent by POST `/api/v1/shizuku/remote-shell/run`
  through the existing private-LAN PocketHost gateway.
- Vite forwards the bounded command to Android-loopback
  `http://127.0.0.1:18791/shell/run`. No pairing credential, session
  challenge, second phone step or explicit allowlist is involved.
- The foreground Companion invokes the already-authorized Shizuku Binder's
  `runOwnerAction("shell", command, "")` and returns actual UID/mode,
  command output, or Android refusal to the browser.
- The native phone screen also provides a direct Run control.
- A short command length, one-at-a-time execution, output cap and
  timeout are technical resource constraints, not command-category bans.
- Previous `/submit`, `/poll`, pairing-code UI and
  `RemoteShellInbox.java` are retired.

## Security phase

Functional DEV capability comes first per AGENTS.md. This deliberately
unauthenticated HTTP path is suitable **only on the owner's private LAN**:
any host able to access the local control origin may be able to invoke
powerful Android shell operations, and HTTP does not protect secrets.
Do not expand exposure to WAN, publicly hosted websites or unrelated
Termux services. Authentication, TLS, device identity and policy controls
will be designed in the separate final security phase, not as UI blockers
during feature acceptance.

## Physical DEV acceptance — PASS (2026-11-09)

Validated **exact application source**:
`PocketHost/main@186185680d74ffc1d44eaedeb6ee4702a1f6174e`.

- Samsung Termux Local Agent exact-source QA: 9/9 Node backend/network
  contract tests and 2/2 browser interaction tests PASS; `admin:lint`,
  TypeScript and Vite `admin:build` PASS.
- Native Android Companion debug APK: Mac Gradle 8.11.1
  `:app:assembleDebug` PASS. Exact APK SHA-256:
  `0c08570046235c6a18a08e753e81093a1023bb38c9c2370b631cf990bd07058e`.
- Signed APK installed on **one exact Samsung SM-S906B**, verified by
  installed bytes; previous signed APK saved for rollback, activity
  launched, no rollback required.
- Controlled restart of **only verified PocketHost DEV Vite process**:
  live source `1861856`, owner PID `18638` at acceptance, HTTP
  `200` for native status/apps/system, local and LAN Shizuku page,
  and installed browser shell module.
- Real LAN-origin `POST /api/v1/shizuku/remote-shell/run` of
  harmless `id`: **PASS**, `mode=adb`, `success=true`,
  Android output contained the real `uid=` value.
- Unauthorized GET to shell path rejected (403). Existing unrelated
  `/api/v1/shizuku/apps` POST rejected (405).
- All six observed protected Termux services remained in their
  prior `run` state: wreckscanner, cloudflared, sshd, mosquitto,
  ilestoi-healthwatch and termux-agent.

Exact Local Agent receipt:
`pockethost-direct-shell-guarded-dev-cutover-1861856-20261109-gpt6-v1`
on the approved `android-termux-10520` installation, terminal
`done / PASS / exit 0`. Companion APK install receipt:
`pockethost-direct-shell-companion-guarded-install-1861856-20261109-gpt6-v1`.

**Ready for owner browser test:**
`http://192.168.0.100:18878/shizuku` → Advanced shell →
enter `id` → **Run on Samsung**. No pairing code or second phone
confirmation. Hard refresh if the browser cached the old paired UI.

## Separately pending

- Owner's final visual/manual desktop UX confirmation.
- The extra intentional invalid-command and legacy `submit/poll` route
  hardware regression task; do not equate the absence of this optional
  result with failure of the already verified positive `id` path.
- Final-stage authentication/TLS hardening is outside this functional
  DEV milestone; the private-LAN HTTP command endpoint is deliberately
  unauthenticated in this owner-approved version.
