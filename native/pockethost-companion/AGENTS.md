# Native Android Companion

PocketHost Companion is the owner's Android Shizuku backend. Real Binder
authorization comes from Shizuku and Android, not an invented product gate.
The owner explicitly requires **full direct power-user operations first**.

**Advanced Shell**: pressing Run in the PocketHost private-LAN browser or
inside the native Companion executes the exact typed command immediately
via the authorized Shizuku UID. Do not add pairing codes, secondary phone
confirmations, approval queues, credential challenges, arbitrary command
allowlists or permanent read-only restrictions in the DEV phase.

The foreground monitoring service already hosts an Android-loopback telemetry
bridge and now also a bounded direct shell route. The bridge remains bound
only to Android loopback; Termux forwards through the existing owner-private
LAN gateway. ADB Shizuku is not root. Missing Shizuku authorization and real
Android permission failures must be reported accurately.

Security hardening, optional authentication and TLS belong to a separately
planned final phase. The interim HTTP LAN shell is intentionally unencrypted
and unauthenticated; do not call it secure or expose it to the public internet.
Do not mutate unrelated Termux services or auto-execute commands on startup.

Use GitHub Connector and authorized Local Agent workflows; no GitHub Actions,
Codex or ChatGPT Work. Native Gradle/Android builds and tests follow root AGENTS.md:
verified Samsung Termux Local Agent only; do not silently switch to
Mac or another build host. The currently installed Companion remains
protected until an explicit, reversible phone acceptance. No unverified deployment claims.
