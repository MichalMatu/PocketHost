---
status: accepted
owner: config
last_reviewed: 2026-11-05
purpose: Define the config module contract
---

# Config Module

## Responsibility

Validate and persist PocketHost-specific settings; read external config only via inventory.

## Inputs and outputs

Inputs will be typed application contracts, not free-form shell strings. Outputs expose an explicit availability/permission/error state and never leak secrets. Final interface schemas are deferred until the module is implemented.

## Forbidden

Never overwrite other applications settings, Termux global files or environment secrets.

## Quality

Tests cover schema failures, safe defaults and redaction.
