---
status: accepted
owner: diagnostics
last_reviewed: 2026-11-05
purpose: Define the diagnostics module contract
---

# Diagnostics Module

## Responsibility

Expose sanitized, bounded and attributable status/log summaries.

## Inputs and outputs

Inputs will be typed application contracts, not free-form shell strings. Outputs expose an explicit availability/permission/error state and never leak secrets. Final interface schemas are deferred until the module is implemented.

## Forbidden

No unrestricted filesystem reads, secret dumps or hidden repairs.

## Quality

Tests cover truncated output, permissions, timeouts, secret redaction.
