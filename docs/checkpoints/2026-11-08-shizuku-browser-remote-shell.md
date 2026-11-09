---
status: superseded
owner: shizuku
last_reviewed: 2026-11-08
purpose: Browser-to-phone confirmed remote shell bridge and acceptance dependencies
---

# PocketHost — paired Shizuku remote shell from browser

**Historical source candidate only; do not deploy.** Superseded by the
2026-11-09 owner instruction for direct unpaired shell execution.
The approved and physically tested live implementation is documented in
[direct browser shell checkpoint](2026-11-09-shizuku-direct-browser-shell.md).
The pairing code, phone-approval inbox, and submit/poll endpoints were
removed from current source.


## Owner decision

The owner wants to submit and read Android Shizuku shell commands from a
desktop browser, not solely inside the Android Companion. The existing
LAN dashboard remains login-free on trusted Wi-Fi; therefore it cannot
expose a directly executable generic shell endpoint.

## New implementation (source only)

- Browser **Android & Shizuku → Advanced shell** accepts a command of at
  most 240 characters, a temporary 10-digit code, and displays request
  status and bounded output. The code stays in the browser tab memory;
  no query-string, localStorage, cookie or persistent shell history.
- On Samsung, **PocketHost Companion → Advanced shell** has separate
  actions to arm a pairing code for 10 minutes, review a pending exact
  command, execute or deny it, and disable pairing.
- Android's loopback-bound Companion bridge accepts only two bounded
  JSON request routes, `POST /shell/submit` and `POST /shell/poll`.
  They enqueue or report a request, **never execute** one.
- The actual Shizuku `UserService` call occurs only after confirmation
  in the foreground Companion activity on the physical phone.
- The Termux Vite route `POST /api/v1/shizuku/remote-shell/{submit,poll}`
  forwards the typed payload over existing phone loopback; exact Origin,
  method, trusted host, intent, length and payload checks fail closed.
- Pending requests expire after 90 seconds; only one is pending at a
  time. Five incorrect pairing codes disarm the session. The pairing
  code expires after ten minutes or process restart.
- Browser polling and five recent results are held in local React
  component memory, not in persistent storage. Existing read-only
  `GET /api/v1/shizuku/status|apps|system|app` endpoints are unchanged.

## Security boundaries

This design requires **per-command physical approval**, not background
execution or silently delegated shell authorization. A pairing code
alone does not execute commands. No WAN listener, root escalation,
service takeover or blanket access to other Termux processes is created.
Shizuku ADB runs as shell UID, not root. Denials and OS errors are
reported as failures.

The LAN is HTTP, not TLS: commands and pairing codes are potentially
visible to local network observers. Do not send secrets through it.
A future unattended interactive shell would require a separate
authenticated encrypted transport and owner opt-in; it is not present.

## Physical acceptance — OPEN

Source commits alone do not mean this is installed. Before calling the
feature operational:

1. Run native Java/Android Gradle compile and package checks.
2. Run exact-source Samsung Termux quality checks (contract, UI
   interaction, frontend build, network policy).
3. Install the exact-source Companion APK on the intended Samsung.
4. Sync/restart only the verified PocketHost DEV panel.
5. Confirm both negative and positive cases on the physical phone:
   disarmed submit rejected, wrong code rejected, valid code queues,
   phone denial does not run, expiry does not run, phone approval of
   harmless `id` returns the real UID/result in desktop browser, and
   Shizuku disconnect is reported accurately.
6. Confirm no unrelated Termux services were changed and keep rollback.

This checkpoint records the implementation scope, **not hardware PASS**.
