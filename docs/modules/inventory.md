---
status: accepted
owner: inventory
last_reviewed: 2026-11-05
purpose: Define the inventory module contract
---

# Inventory Module

## Responsibility

Observe services, endpoints and installed tools using the read-only host adapter.

## Inputs and outputs

Inputs will be typed application contracts, not free-form shell strings. Outputs expose an explicit availability/permission/error state and never leak secrets. Final interface schemas are deferred until the module is implemented.

## Forbidden

No service actions, config writes, adoption of discovered processes or unbounded scans.

## Quality

Tests cover missing tools, malformed outputs, permission errors, redaction and ownership = external/unknown.
