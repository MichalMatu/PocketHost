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

Inputs will be typed application contracts, not free-form shell strings. Outputs expose an explicit availability/permission/error state and never leak secrets. Final interface schemas are deferred until the module is implemented.

## Forbidden

Do not import/adopt IleStoi.pl or mutate discovered document roots.

## Quality

Tests cover path confinement, metadata validation and rollback once enabled.
