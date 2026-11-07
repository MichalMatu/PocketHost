# Observability Module Agent Instructions

## Scope

Own pure typed aggregation of admitted read-only host, process,
runtime and package observations. Follow the
[module contract](../../../docs/modules/observability.md) and
[ADR-0010](../../../docs/adr/0010-read-only-observability.md).

## Forbidden

No direct OS access, shell execution, signals, service restart,
inferred ownership, package mutation, broad scanning or
automatic recovery. Only `host` may inspect Termux and `/proc`.
Never synthesize missing data or expose secrets or raw paths.

## Gate

Test staleness, missing permissions, bounded history, redaction,
PID reuse, foreign ownership and zero side effects. All checks
must execute through the exact Samsung Termux Local Agent.
