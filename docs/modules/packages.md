---
status: accepted
owner: packages
last_reviewed: 2026-11-05
purpose: Define the packages module contract
---

# Packages Module

## Responsibility

Present package availability and future curated installation plans.

## Inputs and outputs

Inputs will be typed application contracts, not free-form shell strings. Outputs expose an explicit availability/permission/error state and never leak secrets. Final interface schemas are deferred until the module is implemented.

## P4 PhotoMap read-only inventory

The P4 managed PhotoMap example displays the imported, allowlisted Termux tool names and versions plus SHA-256 hashes of stored dependency lockfiles. The host adapter reads sealed manifests; neither UI nor this module can run package commands. An update proposal and an explicit approval transaction remain a later milestone because the imported Debian PRoot image is not an isolated restorable release.

## Forbidden

No automatic `pkg install`, `pkg upgrade`, repository changes or arbitrary command execution.

## Quality

Tests cover explicit approval, allowlist and no-op paths; installation remains disabled in first milestone.

## O1 Package Inventory — source candidate

Expose read-only bounded Termux, npm/Node
and Python installed versions with provenance.
Separate installed version, update availability,
unknown metadata and permission failures.
No failed network lookup may be reported as
proof that all packages are current.

Host commands require fixed reviewed arguments
behind `host`; no automatic package install,
upgrade, repository mutation or global Termux
changes. Keep rolling-release host upgrades
separate from application dependencies.
The host source candidate runs only fixed read-only `dpkg-query`,
`node`/`npm`, `python3 -m pip list` and cached `apt list --upgradable`
arguments, with timeouts and bounded output. Installed Termux packages,
global npm metadata and pip metadata are sanitized before display.
Cached update hints are explicitly **unverified**, never a claim that
the host is up to date. No package changes, network refresh or installs
are performed. Native source and actual device acceptance remain pending.
See [ADR-0010](../adr/0010-read-only-observability.md).
