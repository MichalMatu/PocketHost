# Ai Module Agent Instructions

## Scope

Reserve a separately authenticated interface for future AI-assisted publishing. Contract: `../../../docs/modules/ai.md`.

## Forbidden

Do not enable external endpoints, shell access, privileged installs or unauthenticated deploys. Inherit all root `AGENTS.md` safety constraints.

## Gate

Tests eventually cover scoped token, payload validation, idempotency and rollback; no implementation in P0/P1. Run the foundation gates and add module-specific tests when implementation begins.
