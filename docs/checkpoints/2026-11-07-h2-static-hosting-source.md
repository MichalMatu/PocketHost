---
status: implementation-pending-native-acceptance
owner: core
last_reviewed: 2026-11-07
purpose: H2 self-hosted static-site implementation, risks and physical release gate
---

# H2 — multiple user-owned static sites on Android Termux

## Scope and unchanged H1 baseline

The owner approved one large H2 functional sprint: create multiple sites from
the browser, upload a ZIP or browser-selected folder, deploy updates, roll back,
start/stop/restart, inspect logs and resource statistics, and accept the
result on Samsung through a guarded release.

Previous H1 application source `1edbd1b68cb1d0f4c21796172d25c5d0da10ebab`
remains the **accepted and deployed** rollback baseline. H2 source commits
on `main` do not themselves switch that running panel.

## Source candidate

- `src/modules/sites/site-bundle.ts`: bounded ZIP central-directory parser
  and folder-base64 decoder. Reject ZIP slip, archive symlinks, invalid
  compression, corrupt CRC, unsupported extensions, case-folded duplicates,
  unsafe names, oversized uploads and missing root `index.html`.
- `src/modules/host/site-fleet-host.ts`: explicit owner markers under
  `~/Projects/PocketHost-UserSites`, at most eight sites and an owned
  loopback port pool `19080–19095`. Each project has its own process
  PID/start-ticks record, health, logs and resource counters. No adoption
  of observed listeners or process names.
- `src/modules/host/site-fleet-server.mjs`: static-asset GET/HEAD only,
  bounded file reads, no dotfiles, path traversal, symlink following,
  directory listings, server-side commands or package execution.
- `src/modules/host/site-fleet-proxy.mjs` and `lan-gateway.mjs`:
  authenticated-by-owner-record **GET-only** private LAN preview route
  `http://<phone-private-ip>:18879/h2/<site-id>/` after exact running
  child verification. No new LAN listening port or WAN publication.
- `apps/admin/vite.config.ts`: serialized, separately feature-flagged private
  `/api/v1/sites` controls. Same-origin, loopback and deliberate intent
  are required for writes; no arbitrary host path, command, PID or
  port accepted from request bodies.
- `apps/admin/src/app/sites/page.tsx`: create, ZIP/folder import,
  publish/rollback, start/stop/restart, health, history, logs, file
  inventory and memory/uptime display. All upstream template pages remain.

Only static frontends and relative asset URLs are supported. No
backend program launch, arbitrary scripts, multi-user accounts,
package management or untrusted network exposure. The manually
enabled home-LAN administration endpoint remains HTTP **without
authentication**: only operate it on an approved trusted subnet.

## Resource limits and rollback

- 8 explicitly created projects; each has a distinct bound loopback port.
- ZIP input up to 6 MiB; unpacked site up to 8 MiB, 100 files and
  2 MiB per asset; no executable server payloads.
- Each deployment creates an immutable release folder. Switching the
  active marker is atomic; the previous release is retained as a
  one-use rollback point. At most 16 release-directory entries are
  admitted per site until a separately designed safe prune operation.
- Process mutations require exact project ID, marker, PID, start ticks,
  cwd, approved server script, instance and port. Unknown identity
  fails closed without signalling another service. No autostart.
- The six existing services and imported PhotoMap remain read-only
  and excluded from all H2 operations.

## Pending native and release gates

1. Run `npm run check:all` in a clean exact-main detached QA checkout
   **only through the Samsung Termux Local Agent**. Fix focused failures
   without weakening tests. Record Node/Vitest counts and exact SHA.
2. On Samsung, test a genuinely uploaded new HTML/CSS/JS site,
   then a second distinct site; verify isolation and live GET/HEAD
   assets, update, one-use rollback, restart/stop/start, bounded logs
   and memory/uptime readings if accessible.
3. Verify traversal, ZIP bomb/symlink, malicious PID, port collision,
   foreign-origin and missing-intent denial; verify protected six
   services and PhotoMap TEST 8010 before/after.
4. Only after exact-SHA G2, perform a guarded PocketHost-only live
   panel switch with old PID/start-ticks checks and automatic rollback
   on failure. Test real LAN site preview paths and the admin UI.
5. Record independent owner Mac Chrome ZIP/folder interactions
   separately. HTTP probes are not browser-button acceptance.

**H2 is SOURCE ONLY until terminal device and live-release receipts
prove otherwise.**

See the [handoff](../HANDOFF_NEXT_CHAT.md), [roadmap](../ROADMAP.md),
[quality gates](../QUALITY_GATES.md) and [H1 acceptance](2026-11-07-h1-hosting-mvp-source.md).
