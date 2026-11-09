---
status: accepted-with-follow-up
owner: host
last_reviewed: 2026-11-09
purpose: Single Termux/Android host adapter and verified ownership contract
---

# Host Module

## Responsibility and boundaries

**src/modules/host** is the only PocketHost module permitted
to execute OS/process commands, inspect Termux files and
runit, manage exact owned children or proxy the Android-loopback
Companion. UI and other feature modules use typed contracts,
not direct shell, filesystem scans or imports of host internals.

Observed services remain **external**. Generic Termux
runit inventory is not lifecycle permission; protect IleStoi,
PhotoMap, Local Agent, SSH, Cloudflare, existing sites, and
their ports/data. Never infer ownership from names, PIDs
or listeners. Explicit user action is not a substitute
for verifying the exact owned target.

## Active adapters

- **host-snapshot.ts / observability-probes.ts:** sanitized,
  bounded read-only process/CPU/battery/storage observations;
  restricted Android information reports unavailable.
- **termux-admin.ts, termux-service-admin.ts, termux-restic-admin.ts:**
  named-root files, verified service controls and fixed
  backup operations under reviewed owner intent.
- **site-fleet-host.ts + site-fleet-server.mjs +
  site-fleet-proxy.mjs:** H2 owned static fleet; up to
  eight sites and ports 19080–19095, immutable releases,
  upload/preview/rollback and exact owner/PID/start/cwd
  checks. No unrelated process may be signalled.
- **managed-runtime / PRoot adapters:** generic source
  contracts, bounded child/process-tree observations
  and app-specific inactive PhotoMap TEST profile.
  PRoot is not Android UID isolation; no live PhotoMap
  activation follows from source tests.
- **hosting-registry-store.ts / hosting-service-ownership.ts:**
  M1 revisioned private declarations with atomic write,
  lock/stale-owner protection and pure positive ownership
  diagnostics. A successful diagnostic does **not**
  itself authorize future lifecycle actions.
- **shizuku-companion.mjs + typed command contracts:**
  local-only forwarding to the native Android Companion.
  Actual Shizuku UID/permissions and bounded API inputs
  determine what can execute.

## Implementation and QA requirements

Keep external service observation separate from owned
SiteFleet/ProjectRegistry declarations. Validate all
filesystem roots, symlinks, paths and revision/owner
markers before mutation; avoid shell interpolation.
Runit service operations must verify canonical target,
PID/start ticks/cwd/executable/argv and the independent
manual-disable policy. Unknown identity fails closed.

For a changed host adapter, select the smallest direct
positive and negative tests in tests/quality, covering
ownership, traversal, stale revisions, collision,
timeout, failure exit code and rollback as applicable.
Run them on verified Samsung Termux through Local Agent.
Do not run full QA for an unrelated CSS/markdown change.

Owner-approved trusted-LAN Termux controls and direct
Shizuku shell belong to the explicit DEV scope, but
the only automatic runit startup exception is the
PocketHost panel itself. No WAN, global package update,
arbitrary external service adoption or automatic data
migration.

See [code map](../CODE_MAP.md),
[architecture](../ARCHITECTURE.md),
[quality gates](../QUALITY_GATES.md),
[H2 acceptance](../checkpoints/2026-11-07-h2-static-hosting-source.md)
and [M1 source checkpoint](../checkpoints/2026-11-09-m0-m1-complete-checkpoint-next-chat.md).
The longer 2026-11-05 through 2026-11-09
adapter history remains in Git at
685daea477ab5e4de63e8bd99bf20c10c7647bd9.
