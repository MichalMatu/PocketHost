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

| Priority | Observation / question                                                 | Confirmed source                                                                                  | First-screen placement                                                         |
| -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0       | Is PocketHost reachable? Is its API fast?                              | Owned DEV panel / loopback; HTTP latency                                                          | Compact health state, warning if degraded                                      |
| P0       | Are known external services up? Did one stop?                          | Six exact read-only runit checks via `host/snapshot`                                              | Summary count plus changes/alerts, not six large cards                         |
| P0       | Is the Internet endpoint reachable? What is TCP latency/failure count? | Fixed Termux TCP handshake to `1.1.1.1:443`; not ICMP ping                                        | Main network chart with explicit method and failures                           |
| P0       | Device CPU and current authorization                                   | Existing Android Companion/Bridge status, if authorized and recent                                | Shared CPU/RAM chart, source and freshness                                     |
| P0       | RAM, Termux storage, system uptime                                     | Node/Termux host snapshot                                                                         | Small summary / trend; warn on thresholds                                      |
| P1       | Battery %, charging, temperature                                       | Termux:API percent currently supported; richer battery fields require native Bridge qualification | Compact status and battery trend once verified                                 |
| P1       | Restarts/outages, first failure and last recovery                      | Changes in admitted service state, Bridge state and connectivity samples                          | Bounded recent events with timestamps                                          |
| P1       | Panel/Bridge latency and unavailable samples                           | Existing API requests and Companion status adapter                                                | Secondary latency and failure trend                                            |
| P1       | Free space trend and low-storage warning                               | Termux home filesystem snapshot; no other filesystem scans                                        | One small trend, warning before critical threshold                             |
| P0       | Actual device RX/TX rate (all interfaces combined)                     | Native Android Companion TrafficStats, confirmed on Samsung S22+                                  | Rate trend with fresh observed timestamps, no invented zero                    |
| P2       | Separate Wi-Fi/mobile network totals and per-interface accounting      | Not yet provided by current Android TrafficStats contract                                         | Keep unavailable pending NetworkStatsManager permission/accuracy qualification |
| P2       | Per-process CPU, logs, package versions, terminal and host inventory   | Existing detail modules; partial permission-constrained process visibility                        | Drill-down only, except specific actionable alerts                             |
| P2       | Project uptime, published revision, backup failures                    | PocketHost-owned project and backup records, only where ownership is proven                       | Small Hosting health summary after typed integration                           |

## Actual observed service catalog (read only)

The current six-card host snapshot uses **legacy compatibility identifiers**,
not a complete or newly discovered machine inventory:

| Snapshot ID   | Exact fixed runit unit                     | Role                             |
| ------------- | ------------------------------------------ | -------------------------------- |
| `ilestoi`     | `wreckscanner`                             | External web-application service |
| `tunnel`      | `cloudflared`                              | External tunnel                  |
| `ssh`         | `sshd`                                     | External SSH                     |
| `mqtt`        | `mosquitto`                                | External MQTT                    |
| `healthwatch` | `ilestoi-healthwatch`                      | External website health watcher  |
| `local-agent` | `termux-agent` (separate known runit root) | External task agent              |

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
3. Keep a bounded last-24-hour ring buffer (up to **1,440 points**) and
   genuine hourly checkpoints up to **7 days** (at most 168) in RAM and
   persist them to a private, atomic, mode-0600 local file under the
   PocketHost-owned state directory. Validate timestamps and types on
   reload; reject symlinks, corrupt/oversized persistence, or rollback
   attempts. This modest file is an interim implementation, not a new
   database. Future high-cardinality telemetry can move to SQLite.
4. Expose only a fixed, same-origin **GET** history endpoint, supporting
   `1h`, `24h`, or `7d`; no user-selected IP/port, commands, file paths or
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

## Implemented and device-accepted telemetry (2026-11-10)

- Native Companion status now offers Android `TrafficStats.getTotalRxBytes/getTotalTxBytes`
  totals with explicit `all-interfaces-since-boot` scope, observation time and
  `null` on unsupported access. Two monotonic observations at most five
  minutes apart derive sampled RX/TX Mb/s. No old APK value becomes zero.
  Signed native APK installation and live sampled totals are **PASS** on
  Samsung S22+ (8.56-second physical double sample); separate per-interface
  Wi-Fi/mobile and NetworkStatsManager accounting remain outside scope.
- History retains full-resolution 60-second observations up to 24 h and,
  once old points have actually aged out, one genuine checkpoint per hour
  up to 7 days. A sleeping/terminated collector leaves gaps. Existing
  v1 history files without `archive` or `network*` fields remain readable.
- Redacted service/connection events now include battery <=20% while
  discharging, free Termux storage <=512 MiB, recovery thresholds,
  collector starts, and successful PocketHost-owned backup/release actions.
  No foreign service is adopted and no automatic action is triggered.
- Selection is `1h`, `24h`, `7d` through the fixed same-origin endpoint.
  Exact-SHA Samsung tests passed (20/20 Node, impacted UI, both TypeScript
  checks). PocketHost-only panel restart retained 83 previous samples,
  the refreshed endpoints returned HTTP 200, and protected services were
  unchanged. A real screen-off/on check retained all 87 historical samples
  and added a new measurement. An extended multi-day physical sleep
  observation remains separate from the deterministic retention test.

### Seven-day reload repair (source candidate; pending Samsung check)

After a panel suspension lasting more than 24 hours, reload now folds the
actual older persisted samples into hourly archive checkpoints before
dropping them from the live daily ring. The archive does not interpolate
missing minutes. The focused regression covers 50 hours without collection,
existing archived hours, a same-hour replacement, and persistence across
a second restart. This repair requires separate exact-SHA Termux acceptance
and a PocketHost-only panel refresh; previous physical receipts apply to
`bf7a640` only.

### Dashboard presentation re-audit (2026-11-10; new UI awaiting Samsung QA)

| First-screen display                               | Source and scope                                 | Duplicate audit                                                      |
| -------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| Android CPU and CPU history                        | Authorized Companion, recent CPU sample          | One number and one trend; remove repeated CPU value below graph      |
| Free system RAM and RAM-used trend                 | Termux host snapshot, same device RAM            | Complementary units (GiB versus percent), not independent sensors    |
| Free Termux-home storage and storage-used trend    | Same mounted filesystem                          | Same capacity measure in GiB / percent; avoid repeated footer values |
| External services (running / total) and events     | Fixed read-only inventory + recorded transitions | Current state versus incidents; never adopt services                 |
| Battery, charging, temperature and battery history | Termux:API when fresh                            | Real absent readings stay unavailable; avoid repeated numeric footer |
| Uptime                                             | Device/system uptime from host                   | Single status, no redundant uptime chart                             |
| DNS lookup                                         | Fixed Termux DNS probe                           | Current status only; do not confuse with TCP or RX/TX                |
| TCP handshake                                      | Fixed 1.1.1.1:443                                | Endpoint connectivity and latency, not Internet download speed       |
| Android RX/TX                                      | Native all-interface TrafficStats                | Transfer rate, not TCP latency; real zero differs from unavailable   |
| Bridge API latency                                 | Measured status API response                     | Internal Bridge responsiveness, not the Internet endpoint            |
| Recent events                                      | Whitelisted locally persisted event codes        | A compact time-scoped list, not a second full monitoring screen      |

The UI candidate plots timestamps as actual elapsed time (rather than equal
category spacing), labels date as well as time for 24h/7d views, shows both
median and peak TCP latency without silently clipping outliers, and exposes
collector freshness beside the refresh control. These are UI-source changes
until exact-SHA Samsung validation and owned-panel HMR/deployment receipts.

**Highest-value missing operational signal:** last successfully verified
PocketHost-owned backup with age and explicit failure/unavailable state,
ideally alongside owned site's HTTP health. Service-running alone does not
prove a hosted site is usable or recoverable. Pull this only from typed,
ownership-verified PocketHost records; do not infer backups from unrelated
files or claim that an observed external service is hosted by PocketHost.
