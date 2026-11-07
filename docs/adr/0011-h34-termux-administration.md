---
status: proposed
owner: core
last_reviewed: 2026-11-07
purpose: H3.4 owner-approved password-free administration over fixed private LAN
---

# ADR-0011: Full Termux administration as a local control plane

## Decision

Use existing Termux programs rather than reimplementing their engines:
`apt-get`/`dpkg-query`/`apt-cache`, `runit`/termux-services,
`restic` and `ttyd`. Support a typed UI/API with a bounded
filesystem adapter and no extra public listener.

The owner explicitly does not want a password gate. The existing
private-LAN restriction, fixed loopback upstream, origin/intent
checks and manual action confirmations remain, but do not amount
to user authentication.

## Boundaries

Do not infer ownership of services from names, ports or PIDs.
Termux shell use is deliberate and manual: one ttyd session,
loopback only, no boot service. Files require an explicit named
root and reject traversal or symlink following. Restic restore
is staged, never automatically applied to the running environment.
The agent interface is the same typed local API; it does not
replace or modify the installed Local Agent Git task transport.

## Consequences

Trusted-LAN members can perform privileged *Termux-user* actions,
including executing commands through the interactive terminal.
An untrusted LAN, router port forward, tunnel, public reverse
proxy or automatically exposed terminal would be unacceptable.
Separate encryption-key storage and a recovery drill are required
before calling system backups disaster-recovery ready.
