# Host Module Agent Instructions

## Scope

The sole future adapter for Termux process and filesystem inspection, behind typed application ports. Specification: `../../../docs/modules/host.md`. Read-only allowlisted probes first.

## Forbidden

No unrestricted shell input, arbitrary filesystem access, secret environment dumps or mutation of existing services. No service start/stop until a separate ownership and permission contract is approved.

## Gate

Test allowlist rejection, timeouts, partial output and failed permissions. All other source modules must be prevented from importing OS/process primitives directly.

## Owner-approved H3.4 branch exception

The owner expressly authorized full Termux control without first
building login. The host module may provide named-root file operations,
registered runit lifecycle/autostart, fixed Restic commands and a
single manual ttyd launcher on `127.0.0.1`. It must not expose
arbitrary shell strings through the JSON API. ttyd is an interactive
owner-requested terminal, not a command-injection primitive or a
public network service. Preserve all external-service and H2
production noninterference rules during QA and release.
