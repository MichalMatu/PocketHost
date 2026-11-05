---
status: accepted
owner: packages
last_reviewed: 2026-11-05
purpose: Define the packages module contract
---

# Packages Module

## Responsibility

Present package availability and future curated installation plans.

## Inputs and outputs

Inputs will be typed application contracts, not free-form shell strings. Outputs expose an explicit availability/permission/error state and never leak secrets. Final interface schemas are deferred until the module is implemented.

## Forbidden

No automatic `pkg install`, `pkg upgrade`, repository changes or arbitrary command execution.

## Quality

Tests cover explicit approval, allowlist and no-op paths; installation remains disabled in first milestone.
