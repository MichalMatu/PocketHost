---
status: source-candidate
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

## Acceptance before marking done

1. Build exact-source Companion APK on the already authorized Mac toolchain.
2. Verify signed APK and install/rollback on the single physical Samsung.
3. Exact-source Node, UI, TypeScript, lint and native compilation checks.
4. Restart only the independently verified PocketHost-owned DEV panel.
5. Physically test `id` from the desktop browser, report expected UID,
   test an intentional failing command, and check command output.
6. Confirm legacy pairing routes are retired and other Termux services
   remain unchanged.

This file records implementation, **not** operational hardware PASS.
