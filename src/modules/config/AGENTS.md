# Config Module Agent Instructions

## Scope

Validate and persist PocketHost-specific settings; read external config only via inventory. Contract: `../../../docs/modules/config.md`.

## Forbidden

Never overwrite other applications settings, Termux global files or environment secrets. Inherit all root `AGENTS.md` safety constraints.

## Gate

Tests cover schema failures, safe defaults and redaction. Run the foundation gates and add module-specific tests when implementation begins.
