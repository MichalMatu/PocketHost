# Runtime Module Agent Instructions

## Scope

Manage lifecycle of explicitly PocketHost-owned server instances once ownership is implemented. Contract: `../../../docs/modules/runtime.md`.

## Forbidden

No action on processes discovered by inventory; no PID-only ownership; no implicit auto-restart. Inherit all root `AGENTS.md` safety constraints.

## Gate

Tests cover ownership proof, port collision, failed startup, shutdown and cleanup without touching other services. Run the foundation gates and add module-specific tests when implementation begins.
