---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-10
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

## Approved target: single Android app and unified telemetry flow

**Owner decision, 2026-11-10.** The target is one main PocketHost
Android application integrating the existing native Companion/Bridge,
the current React UI and the Termux backend. It is an architectural
target, **not** a claim that a unified APK already exists.
The [isolated APK packaging decision](adr/0015-unified-android-app-isolated-runtime.md)
sets the clean-install and custom-prefix feasibility gates.

```text
Main PocketHost Android app / shared React Dashboard
    |
    +-- Native Companion/Bridge -- Android API telemetry
    |                               (battery, hardware, network if permitted)
    +-- optional Shizuku UserService -- privileged Android CPU/process data
    |                                    under actual authorized ADB/root UID
    +-- Termux / Node.js host adapter -- RAM, storage, runit, owned workloads,
                                         connectivity probes
                  |
           typed, read-only device-local telemetry
                  |
           observability normalization (source, scope, unit, time, state)
                  |
           bounded sample history (planned local SQLite)
                  |
           Dashboard charts + detailed module screens
```

- **Android Bridge is the primary Android measurement source.** Reuse
  the existing Android-loopback `127.0.0.1:18791` Companion status
  transport and typed Termux adapter; never expose raw Binder or
  unrestricted native actions to the LAN. CPU/process bridging
  exists; not every target metric has been implemented or accepted.
- **Shizuku is optional**, not a dashboard prerequisite. ADB is not
  root. Authorization and background sampling can stop after a
  reboot, suspension or revocation; show missing/stale rather than
  fake data. Continue to require explicit user consent for the
  existing visible foreground telemetry service (max once per 15 s).
- **Termux remains the host and collector** for its accessible
  metrics, fixed bounded connectivity probes, verified service
  states and locally owned project lifecycle. No new process
  manager or always-on sampling daemon.
- **Observability only aggregates** validated read-only samples.
  Every measurement identifies `source`, `scope` (device, Termux,
  PocketHost-owned), `unit`, `observedAt`, availability/permission
  `state` and age. History storage in SQLite and 1 h / 24 h
  views are future work with bounded sampling/retention.
- **Whole-device RX/TX is not presently available from Termux**:
  Samsung denied `/proc/net/dev` and `/sys/class/net` statistics.
  A future Bridge `NetworkStatsManager` implementation must first
  verify Usage Access / Android permissions and the resolution of
  aggregated buckets. Do not label aggregated counters as
  instantaneous Mb/s without validated sampling.
- **Latency and reachability** may be measured by bounded Termux
  TCP/HTTP probes. Label actual method (not ICMP ping unless ICMP
  was used). The native owner-approved background path must not
  silently trigger privileged commands, package installation,
  service restart, or changes to external workloads.

First-screen layout and staged migration:
[target information architecture](TARGET_INFORMATION_ARCHITECTURE.md).
Detailed current capability boundaries:
[Observability](modules/observability.md) and
[Shizuku](modules/shizuku.md).

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
