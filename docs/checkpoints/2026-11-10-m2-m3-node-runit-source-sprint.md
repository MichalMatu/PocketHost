---
status: source-implemented-validation-open
owner: hosting
last_reviewed: 2026-11-10
purpose: Compact Node runit M2/M3 source delta, safety gates and pending native acceptance
---

# PocketHost — Node runit M2/M3 source sprint

## Implementation

Source base: 9a7d2f459fcee2412d8edfd918ac3782f8e7bf3b.
Source head before checkpoint: 8fad03efbe0fad870e965e2fcfabf1599f195c9a.

- Reuse the existing TermuxServiceAdmin and upstream runit, without a second process manager, package installer or external-service adoption.
- New NodeRunitHost admits explicit owned projects with zero npm dependencies and no build script; checks installed Node/npm; reserves a private 127.0.0.1 port; registers a disabled runit unit; and requires an explicit one-shot start.
- Ownership proof uses process PID, start ticks, command line, canonical working directory, UID, and verified service definition. Readiness uses a per-release nonce rather than any HTTP 200.
- Updates attempt last-good restoration on failed launch; an unknown process identity blocks cleanup rather than signaling a foreign service. Existing runit logs are available through a bounded adapter.
- The DEV API exposes plan, runtime status, history, logs, explicit Deploy and Stop; the React Projects screen provides these controls and installed versions. Prior source staging and candidate restore remain.
- Targeted tests cover missing approval, unexpected units, port reservation collisions and nonce mismatch. No public route or tunnel was configured.

## Native quality

At SHA 9a7d2f4, the earlier Samsung receipt passed 14/14 Node tests, 1/1 React test and root/admin types/lint/structure/boundary checks. Overall validation was OPEN due to formatting and checkpoint index failure. The index is now repaired.

The first new Samsung task for dd8902d stopped before tests because main advanced; a corrected task targeting 375f56a verifies fetched SHA ancestry and is still PENDING terminal evidence. No newer SHA has a verified native PASS. No new project service was started during this source sprint.

## Acceptance held open

- The separate runtime DEV feature flag stays OFF by default. Any actual execution additionally requires explicit user approval of the candidate release.
- Node apps run with the same Termux user privileges, not an OS security sandbox. Only trusted disposable source is suitable for the first guarded device test.
- Confirm exact-SHA source checks, identity and symlink negatives, port conflict, health nonce and runit one-shot Start/Stop on Samsung before claiming device acceptance.
- Controlled npm install/build, manual active rollback, scoped project Restic restore, M4 Python/SSH/Cloudflare and M5 multi-component deployments remain OPEN.

Next functionality: one disposable dependency-free Node project with verified runit one-shot Start, local readiness and Stop; no existing services or tunnels touched. This checkpoint records source work, not G3 acceptance.
