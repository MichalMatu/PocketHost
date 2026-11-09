---
status: source-implemented-validation-open
owner: config
last_reviewed: 2026-11-09
purpose: Config validation and M1 declarative registry boundary
---

# Config Module

## Responsibility

Validate PocketHost-specific settings and user-created Hosting declarations. Read external configuration only through inventory; discovery cannot grant application ownership.

## M1 source-only registry

The shared pure `hosting-registry.ts` validates module capabilities, planned
services, project components, secret references, duplicate IDs, reserved ports
and stale module versions. The `config/hosting-registry.ts` entrypoint
re-exports this validator; it performs no filesystem or process operations.

The host-only `hosting-registry-store.ts` is an on-demand, revisioned JSON
store in a separately supplied canonical private directory. It checks the
`pockethost` owner marker, rejects symlinks, uses exclusive file locking and
atomic replacement, and refuses stale revision writes. It does not create a
service, register runit, discover processes or activate a hosted workload.
Unknown storage schemas fail closed; cross-version migration and live UI/API
wiring remain open. The source is **not yet accepted on Samsung** for the
refactored SHA.

## Inputs and outputs

Inputs are bounded typed declarations, not free-form shell commands. Outputs
contain only validated metadata and opaque secret references, never secret
values or an assertion that a running process is owned.

## Forbidden

Never overwrite other applications settings, Termux global files or environment secrets.

## Quality

Existing M1 tests cover malformed and duplicated identities, reserved ports,
foreign observations, secret injection, stale storage revisions, symlinks and
concurrent locks. Native focused results must be read before claiming PASS.

## M1 explicit rollback planning — source only

`src/modules/host/hosting-registry-recovery.ts` verifies a private v1
snapshot and a strictly older backup, then checks expected revision and
trusted SHA-256 fingerprints before producing a next-revision declaration
plan. It neither reads nor writes actual registry files, and does not
implement schema-v2 migration. A host-side backup provenance check and
atomic audited restore are still required before live use. Native focused
QA remains OPEN.
