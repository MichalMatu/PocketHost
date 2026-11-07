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

## O1 Runtime Diagnostics — proposed

Reuse structured runtime events and dry-run
recovery decisions to provide a bounded,
redacted history of starts, stops, crashes,
timeouts, unresolved descendants and
unknown process claims.

Tag every event with stable safe identity,
timestamp, event code and source. Retain
explicit unknown states; no automatic
signals, claim deletion or service restart.
See [ADR-0010](../adr/0010-read-only-observability.md).
