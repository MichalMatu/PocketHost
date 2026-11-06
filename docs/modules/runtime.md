---
status: accepted
owner: runtime
last_reviewed: 2026-11-05
purpose: Define the runtime module contract
---

# Runtime Module

## Responsibility

Manage lifecycle only of explicitly PocketHost-owned server instances. P3 introduces a restricted, opt-in single-site implementation candidate; no foreign-process adoption.

## Inputs and outputs

The P3 candidate's typed `OwnedSitePort` exposes inspect, create, start, stop, publish, rollback and bounded logs for a fixed demo ID. Every mutation requires the current snapshot to identify `ownership: pockethost`; an absent or externally owned site cannot be started or stopped. All filesystem and process side effects remain in the host adapter. This interface is DEV-only and not a general remote process manager.

## P4 PhotoMap hold

The `photomap-test` import is a verified stopped filesystem copy. Its external Debian PRoot is not an isolated, rollbackable runtime, and its old run script still targets the original checkout. The P4 catalog refuses to enable start/stop without a new explicit runtime adapter, isolated dependencies, owned process identity, exact loopback readiness, and negative device tests. A successful import does not authorize a start operation.

## Forbidden

No action on processes discovered by inventory; no PID-only ownership; no implicit auto-restart.

## Quality

Tests cover ownership proof, port collision, failed startup, shutdown and cleanup without touching other services.

## Acceptance state

The candidate is not released. Native feature tests, negative HTTP tests and actual phone-browser lifecycle acceptance remain mandatory before controls can be enabled.
