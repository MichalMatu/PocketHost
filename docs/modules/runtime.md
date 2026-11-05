---
status: accepted
owner: runtime
last_reviewed: 2026-11-05
purpose: Define the runtime module contract
---

# Runtime Module

## Responsibility

Manage lifecycle of explicitly PocketHost-owned server instances once ownership is implemented.

## Inputs and outputs

Inputs will be typed application contracts, not free-form shell strings. Outputs expose an explicit availability/permission/error state and never leak secrets. Final interface schemas are deferred until the module is implemented.

## Forbidden

No action on processes discovered by inventory; no PID-only ownership; no implicit auto-restart.

## Quality

Tests cover ownership proof, port collision, failed startup, shutdown and cleanup without touching other services.
