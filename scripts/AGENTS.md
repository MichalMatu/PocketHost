# Scripts Agent Instructions

## Scope

Local structure and documentation quality gates. No feature code or device orchestration.

## Forbidden

Never mutate physical host services, execute GitHub Actions, write outside the checkout or auto-install OS packages.

## Gate

Checks must be deterministic, dependency-free for Gate 0 and tested with negative fixtures.
