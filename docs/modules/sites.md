---
status: accepted
owner: sites
last_reviewed: 2026-11-05
purpose: Define the sites module contract
---

# Sites Module

## Responsibility

Define metadata for PocketHost-owned sites and future deployment versions.

## Inputs and outputs

The P3 candidate has one allowlisted ID, `pockethost-demo`, and two built-in static HTML versions. Switching versions and rollback never accept arbitrary uploads or paths. The metadata/ownership record is separate from the served `index.html`. Site actions are intentionally gated behind a disabled-by-default, local DEV feature flag.

## Forbidden

Do not import/adopt IleStoi.pl or mutate discovered document roots.

## Quality

Tests cover path confinement, metadata validation and rollback once enabled.

## Acceptance state

Native Termux tests for ownership, path rejection and version rollback passed, and the owner separately confirmed actual MacBook Chrome display of the P3 admin and v1 demo page through the trusted-LAN gateway on 2026-11-06. Browser write-button interaction and P3 release merge remain pending. This is an isolated demonstration site, not a publicly hosted service.

## One-step rollback contract — 2026-11-06

The owner verified that the MacBook controls published the demo version and rolled it back, but reported that repeatedly clicking Rollback flips v1 and v2 forever. Audit found that the old host adapter intentionally swapped `contentVersion` and `previousVersion`, creating a misleading undo/redo loop.

The proposed P3 correction is **single-use rollback**: a successful rollback restores the immediately prior sample version and sets `previousVersion=null` / `canRollback=false`; another rollback returns the existing typed no-prior-version error without touching the served content. A new explicit `Switch sample version` publish establishes a new rollback opportunity. The UI keeps the rollback control visible but disabled when unavailable. The sample publish toggle is deliberately limited to the two bundled demo documents; arbitrary version history and redo are deferred beyond P3.

This source change is **not** an on-device deployment or a browser validation by itself. Run the exact Termux native gates, verify real panel behavior after a guarded release, compare the six existing services, and keep `main` unchanged until acceptance.
