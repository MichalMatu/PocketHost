---
status: accepted
owner: ai
last_reviewed: 2026-11-05
purpose: Define the ai module contract
---

# Ai Module

## Responsibility

Reserve a separately authenticated interface for future AI-assisted publishing.

## Inputs and outputs

Inputs will be typed application contracts, not free-form shell strings. Outputs expose an explicit availability/permission/error state and never leak secrets. Final interface schemas are deferred until the module is implemented.

## Forbidden

Do not enable external endpoints, shell access, privileged installs or unauthenticated deploys.

## Quality

Tests eventually cover scoped token, payload validation, idempotency and rollback; no implementation in P0/P1.
