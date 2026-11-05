---
status: in-progress
owner: host
last_reviewed: 2026-11-05
purpose: Isolate follow-up read-only Termux disk and Local Agent supervision status
---

# P1.1 — Host Health (local agent + storage)

## Scope

Continue from accepted P1 checkpoint `b1c9a632c04ffb16606c61fcd6d85b011b7c6760`; preserve **all 32** upstream ShadcnStore screens plus the existing `/host` view. No UI redesign and no new admin network binding.

- Add `Termux Local Agent` to the **explicit fixed service allowlist**, using its own private runit supervision path read-only. The service is **external**, never owned by PocketHost.
- Add `storage` with total and available MiB for the filesystem containing the **Termux home directory**, using only Node's `statfsSync`. Return `null` on failure, never expose paths, file listings, raw error text or credential data.
- Add one consistent shadcn card; preserve desktop-first layout, refresh, app routes and mobile pinch zoom.

## Strict native acceptance

On the **same physical Termux** via its existing Local Agent host-command lane, test: foundation and unit gate (including invalid/overflow stats and Local Agent private supervision), full app lint/build; then a carefully isolated DEV-only HTTP API check. `GET` must expose six *externally owned* service states, including Local Agent, and sanitized storage numbers or `null`. `POST` remains 405, forged Host and foreign Origin remain 403. Validate existing `/host` and `/dashboard` HTTP 200. No interruption to IleStoi.pl and no new public ports, startup hooks or service management.

Current state: source staged in `feat/host-health-v1`; **native verification and preview switch pending** until actual receipts are returned.
