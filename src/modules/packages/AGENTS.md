# Packages Module Agent Instructions

## Scope

Present package availability and future curated installation plans. Contract: `../../../docs/modules/packages.md`.

## Forbidden

No automatic `pkg install`, `pkg upgrade`, repository changes or arbitrary command execution. Inherit all root `AGENTS.md` safety constraints.

## Gate

Tests cover explicit approval, allowlist and no-op paths; installation remains disabled in first milestone. Run the foundation gates and add module-specific tests when implementation begins.
