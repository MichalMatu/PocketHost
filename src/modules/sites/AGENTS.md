# Sites Module Agent Instructions

## Scope

Define metadata for PocketHost-owned sites and future deployment versions. Contract: `../../../docs/modules/sites.md`.

## Forbidden

Do not import/adopt IleStoi.pl or mutate discovered document roots. Inherit all root `AGENTS.md` safety constraints.

## Gate

Tests cover path confinement, metadata validation and rollback once enabled. Run the foundation gates and add module-specific tests when implementation begins.
