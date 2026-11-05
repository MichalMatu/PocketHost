# Diagnostics Module Agent Instructions

## Scope

Expose sanitized, bounded and attributable status/log summaries. Contract: `../../../docs/modules/diagnostics.md`.

## Forbidden

No unrestricted filesystem reads, secret dumps or hidden repairs. Inherit all root `AGENTS.md` safety constraints.

## Gate

Tests cover truncated output, permissions, timeouts, secret redaction. Run the foundation gates and add module-specific tests when implementation begins.
