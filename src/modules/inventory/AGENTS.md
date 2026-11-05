# Inventory Module Agent Instructions

## Scope

Observe services, endpoints and installed tools using the read-only host adapter. Contract: `../../../docs/modules/inventory.md`.

## Forbidden

No service actions, config writes, adoption of discovered processes or unbounded scans. Inherit all root `AGENTS.md` safety constraints.

## Gate

Tests cover missing tools, malformed outputs, permission errors, redaction and ownership = external/unknown. Run the foundation gates and add module-specific tests when implementation begins.
