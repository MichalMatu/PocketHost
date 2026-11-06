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
