---
status: accepted-with-follow-up
owner: observability
last_reviewed: 2026-11-10
purpose: Map available PocketHost telemetry to first-screen decisions and a bounded local history flow
---

# Dashboard telemetry and service map

## First-screen rule

The main Dashboard is a **read-only health overview**, never a second Services,
Android, Packages or Hosting screen. Display a number only if the source and
scope are known; always show missing/stale measurements, not fabricated zeros.
The example Dashboard under `/examples/dashboard` is visual reference only.

| Priority | Observation / question | Confirmed source | First-screen placement |
| --- | --- | --- | --- |
| P0 | Is PocketHost reachable? Is its API fast? | Owned DEV panel / loopback; HTTP latency | Compact health state, warning if degraded |
| P0 | Are known external services up? Did one stop? | Six exact read-only runit checks via `host/snapshot` | Summary count plus changes/alerts, not six large cards |
| P0 | Is the Internet endpoint reachable? What is TCP latency/failure count? | Fixed Termux TCP handshake to `1.1.1.1:443`; not ICMP ping | Main network chart with explicit method and failures |
| P0 | Device CPU and current authorization | Existing Android Companion/Bridge status, if authorized and recent | Shared CPU/RAM chart, source and freshness |
| P0 | RAM, Termux storage, system uptime | Node/Termux host snapshot | Small summary / trend; warn on thresholds |
| P1 | Battery %, charging, temperature | Termux:API percent currently supported; richer battery fields require native Bridge qualification | Compact status and battery trend once verified |
| P1 | Restarts/outages, first failure and last recovery | Changes in admitted service state, Bridge state and connectivity samples | Bounded recent events with timestamps |
| P1 | Panel/Bridge latency and unavailable samples | Existing API requests and Companion status adapter | Secondary latency and failure trend |
| P1 | Free space trend and low-storage warning | Termux home filesystem snapshot; no other filesystem scans | One small trend, warning before critical threshold |
| P2 | Actual device RX/TX rate, interface, Wi-Fi/mobile split | **Not available** to Termux on this Samsung; native Android NetworkStats needs permission/accuracy validation | **Do not display** until confirmed by Bridge |
| P2 | Per-process CPU, logs, package versions, terminal and host inventory | Existing detail modules; partial permission-constrained process visibility | Drill-down only, except specific actionable alerts |
| P2 | Project uptime, published revision, backup failures | PocketHost-owned project and backup records, only where ownership is proven | Small Hosting health summary after typed integration |

## Actual observed service catalog (read only)

The current six-card host snapshot uses **legacy compatibility identifiers**,
not a complete or newly discovered machine inventory:

| Snapshot ID | Exact fixed runit unit | Role |
| --- | --- | --- |
| `ilestoi` | `wreckscanner` | External web-application service |
| `tunnel` | `cloudflared` | External tunnel |
| `ssh` | `sshd` | External SSH |
| `mqtt` | `mosquitto` | External MQTT |
| `healthwatch` | `ilestoi-healthwatch` | External website health watcher |
| `local-agent` | `termux-agent` (separate known runit root) | External task agent |

A service may be `running`, `stopped` or `unknown`. Do not
count `unknown` as healthy. PocketHost's **own** `pockethost-panel` and
`pockethost-panel-watch` are separate supervised units, not part of
this six-service compatibility API. Other runit services can appear in
the separate Services inventory; discovering them does **not** grant control.

## Approved collection and buffered read contract

1. Use the **existing supervised PocketHost Node/Vite process** as the
   one read-only sampler. No additional daemon, package installer, job
   scheduler, native privilege escalation or change to external services.
2. Collect bounded snapshots every **60 seconds** while that owner-approved
   panel process is running, independently of whether any browser tab is open.
   Read only existing fixed host/Bridge adapters and fixed TCP endpoint.
   Never auto-start the Shizuku foreground service; use only readings
   already authorized and fresh. A phone sleep or terminated panel can
   interrupt sampling; never backfill fake points.
3. Keep a bounded last-24-hour ring buffer (up to **1,440 points**) in
   RAM and persist it to a private, atomic, mode-0600 local file under the
   PocketHost-owned state directory. Validate timestamps and types on
   reload; reject symlinks, corrupt/oversized persistence, or rollback
   attempts. This modest file is an interim implementation, not a new
   database. Future high-cardinality telemetry can move to SQLite.
4. Expose only a fixed, same-origin **GET** history endpoint, supporting
   `1h` or `24h`; no user-selected IP/port, commands, file paths or
   arbitrary service IDs. Browser loads the historical window immediately
   on navigation, merges live updates and does not own the historical
   retention.
5. Preserve sample **origin, scope, unit, measured timestamp and availability**
   in the schema/contract. Null means unavailable. The dashboard must show
   stale history after restart/disconnect rather than interpreting last
   known values as current.
6. Never persist raw shell output, process argv, IP/client identities,
   secrets, request headers or foreign service logs in the history file.
   Derive only numeric readings, enumerated service status and limited
   prevalidated event codes. The history is observation, never ownership.

## Acceptance and phasing

The mapping above is a source-derived capability plan, **not a claim** that
all metrics or background history already exist on the device.

The first usable release should deliver a private 24 h buffered ring,
an initial historical chart load and tests for same-origin denial,
no fabricated data, 24 h/1 h retention, corrupt files/symlinks,
service external-ownership invariants and collection while the browser
is closed. A hardware acceptance must check history after closing/reopening
the dashboard and after a deliberate **PocketHost-only** panel restart.

Native battery/NetworkStats, alerts/notifications, richer project health and
longer historical retention are follow-on phases, not hidden prerequisites.

Related: [architecture](ARCHITECTURE.md),
[target Dashboard](TARGET_INFORMATION_ARCHITECTURE.md),
[observability module](modules/observability.md).

## Implemented source delta (2026-11-10, device re-acceptance pending)

- Native Companion status now offers Android `TrafficStats.getTotalRxBytes/getTotalTxBytes`
  totals with explicit `all-interfaces-since-boot` scope, observation time and
  `null` on unsupported access. Two monotonic observations at most five
  minutes apart derive sampled RX/TX Mb/s. No old APK value becomes zero.
  Native APK installation and physical source fidelity on the Samsung are
  still **UNVERIFIED**; per-interface Wi-Fi/mobile and NetworkStatsManager
  accounting are outside this source slice.
- History retains full-resolution 60-second observations up to 24 h and,
  once old points have actually aged out, one genuine checkpoint per hour
  up to 7 days. A sleeping/terminated collector leaves gaps. Existing
  v1 history files without `archive` or `network*` fields remain readable.
- Redacted service/connection events now include battery <=20% while
  discharging, free Termux storage <=512 MiB, recovery thresholds,
  collector starts, and successful PocketHost-owned backup/release actions.
  No foreign service is adopted and no automatic action is triggered.
- Selection is `1h`, `24h`, `7d` through the fixed same-origin endpoint.
  Acceptance still requires exact-SHA Samsung focused tests and a deliberate
  PocketHost-only restart/sleep observation, plus a separately built native
  Companion APK and real RX/TX validation.
