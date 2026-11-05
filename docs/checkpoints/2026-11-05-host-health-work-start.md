---
status: accepted
owner: host
last_reviewed: 2026-11-05
purpose: Record native P1.1 Local Agent and disk-status acceptance on Android Termux
---

# P1.1 — Host Health: accepted native checkpoint

## Source and boundaries

Feature `feat/host-health-v1` code commit `58f82e7c9ec6da09aad1207c1244da6d0f01d640`, based on the accepted P1 read-only `/host` integration. Preserves **all 32** original ShadcnStore pages and the same desktop-first UI, cards and manual refresh. One additional card shows storage available on the filesystem containing the Termux home directory, or *Unavailable* on probe failure. One new service entry shows the separate **Termux Local Agent** `runit` supervisor status.

No service controls, new admin ports, boot changes, arbitrary shell commands, path exposure or externally owned-service mutations were added. The API remains **DEV-only and loopback-only** on `127.0.0.1:8787`; production administration/authentication and automated mobile UI acceptance remain separate future gates.

## Verified physical Termux receipts

1. **`pockethost-p11-host-health-native-gates-20261105-v1`** — `done / exit 0`; real Android Termux Local Agent executed `npm run check:foundation` with **21/21 tests PASS**, `npm run lint` in `apps/admin` **PASS**, and `npm run build` **PASS**. The feature worktree `~/Projects/PocketHost-P1` was clean after execution. Tests cover strict allowlist rejection, Local Agent private `runit` scope, disk space in MiB, failed/invalid/overflowing storage readings, and sanitized externally owned service records.
2. **`pockethost-p11-host-health-live-http-20261105-v1`** — `done / exit 0`, result `accepted_live_http`, from the real Termux device. `/dashboard` **200**, `/host` **200**, `GET /api/v1/host/snapshot` **200**, `POST` **405**, foreign Origin **403**, forged Host **403**. API returned exactly **6 externally owned services**, including Local Agent. The independent private `sv status` agreed on Local Agent state `running`. At observation time all six fixed services reported `running`, including IleStoi.pl.
3. The storage read returned **230,065 MiB total / 136,963 MiB available** at the recorded moment. These are **filesystem capacity**, not an application quota or guaranteed future free capacity. No filesystem contents were listed or returned.
4. A Mac Local Agent **read-only SSH diagnostic** confirmed the actual on-phone task result while Git publication was catching up; **no PocketHost build/test commands ran on the Mac**.

## Explicitly not claimed

- An on-phone browser screenshot-diff, touchscreen/pinch gesture, keyboard, accessibility or all-demo-route click-through test: **not automated or accepted**. The owner previously confirmed the panel looks good.
- User authentication, WAN admin access, service restart/stop, installation, AI workloads, APK creation or termux boot fix: **not implemented**.
- Full root Gate 1 `npm run check`: **pending**. The app's own build and lint are accepted separately.
- Last status does not predict future uptime. The separate Local Agent manager's boot-time resilience remains an independent issue.
- No public release, branch merge to `main`, or automatic startup occurred.

## Next scoped step

Strengthen root Gate 1 and reproducible dependency policy on the real Termux environment, or introduce a narrowly scoped read-only server-configuration summary with data minimization and permissions. Keep all 32 demo screens and the successful `/host` behavior unchanged, and independently test any new security-sensitive API.
