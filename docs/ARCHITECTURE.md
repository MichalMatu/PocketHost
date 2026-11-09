---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Current module boundaries, target architecture and host trust rules
---

# PocketHost Architecture

## Current execution boundary

PocketHost is an owner-operated DEV React/Vite console running in
Android Termux. The UI calls typed local API surfaces; feature
modules use shared contracts; **host** owns Termux process and
filesystem actions. Native Android capability is obtained through
the separately authorized Shizuku Companion, not through browser
Binder privileges.

```text
Browser / apps/admin  -> typed API / contracts
                         -> feature modules + src/shared
                         -> src/modules/host -> Termux + owned processes
                      -> Android-loopback Companion -> Shizuku Binder
```

The existing PocketHost DEV panel Vite listener is loopback
127.0.0.1:8787. Its approved gateway may bind only one verified
private LAN IPv4 address on owned ports 18878/18879; the latter
is GET/HEAD-only preview. The private-LAN owner shell is intentionally
DEV-only and is **not** an authenticated public management service.
Never widen to a wildcard listener or WAN. See
[security](SECURITY_MODEL.md), [ADR-0012](adr/0012-private-ui-rapid-review.md),
[ADR-0013](adr/0013-shizuku-power-user.md) and
[ADR-0014](adr/0014-termux-panel-supervision.md).

## Product layers

| Layer             | Responsibility                                                                            | Boundary                                                 |
| ----------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Browser / UI      | Presentation, explicit user actions, errors, navigation                                   | No direct host OS access                                 |
| Feature modules   | Pure runtime, packages, sites, config and observability policies                          | No imports of other modules' internals                   |
| Shared contracts  | Typed immutable identities, lifecycle declarations, capabilities, release/data interfaces | No implicit physical service ownership                   |
| Host adapter      | Exact filesystem/process/runit/Restic/native bridge operations                            | Explicit target, verified ownership, bounded execution   |
| Android Companion | Authorized Android API/Binder Shizuku actions                                             | Android loopback, actual ADB/root UID and OS permissions |

Code map: [CODE_MAP](CODE_MAP.md); module dependency
rules: [MODULES](MODULES.md). Upstream admin screens,
assets and notices remain a pinned reusable baseline.

## Stable source and planned platform

H2 static Hosting uses a **PocketHost-owned** site fleet, bounded
ZIP/folder ingestion, loopback children, immutable releases and
exact process-identity checks. These existing contracts are the
foundation, not something to replace with a second supervisor.

The approved target separates ModuleRegistry (capabilities),
ServiceRegistry (one process owner and runit policy), and
ProjectRegistry (only PocketHost-created Hosting projects with
versioned components). Hosting composes these contracts rather
than managing SSH, Cloudflare, node installs or backups independently.
M1 registry storage and validation are source candidates;
actual registration/migration remains separate. M2/M3 are not
deployed merely because schemas exist.

**Never promote observation to ownership:** IleStoi, PhotoMap,
Local Agent, external tunnels, sshd and discovered sites remain
external until an individually authorized, verified cutover.
Keep data/config and code release boundaries distinct. PRoot
does not isolate an Android UID, and an observed process tree
does not prove orphan-free cleanup.

## Reliability and change policy

Use installed Termux runit via one shared verified adapter, not
new PM2/systemd/watchdog daemons. Different workloads have
separate health policies; explicit manual disable wins over
automatic recovery. Only the owner-approved PocketHost DEV
panel currently has the limited runit autostart/watchdog exception.
Hosted sites and other services do not inherit it.

Source edits and physical operations are independent gates.
Pure code/UI changes use [FAST FLOW](DEV_ITERATION.md);
host commands, routing, file roots, ownership, persistence,
secrets and migrations demand focused negative tests and
disposable device acceptance. Public/product deployment needs
separate [quality gates](QUALITY_GATES.md).

For target navigation and migration order see
[TARGET_INFORMATION_ARCHITECTURE](TARGET_INFORMATION_ARCHITECTURE.md).
Historical P3/O1/H2/PhotoMap implementation narratives remain in
[checkpoints](checkpoints/README.md) and Git revision
685daea477ab5e4de63e8bd99bf20c10c7647bd9.
