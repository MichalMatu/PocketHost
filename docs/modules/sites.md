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

Native Termux test acceptance for ownership, path rejection, version rollback and actual browser display is still pending. This is a candidate, not an externally published hosting service.
