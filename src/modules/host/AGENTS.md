# Host Module Agent Instructions

## Scope

The sole future adapter for Termux process and filesystem inspection, behind typed application ports. Specification: `../../../docs/modules/host.md`. Read-only allowlisted probes first.

## Forbidden

No unrestricted shell input, arbitrary filesystem access, secret environment dumps or mutation of existing services. No service start/stop until a separate ownership and permission contract is approved.

## Gate

Test allowlist rejection, timeouts, partial output and failed permissions. All other source modules must be prevented from importing OS/process primitives directly.
