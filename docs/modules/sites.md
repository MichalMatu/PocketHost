---
status: accepted
owner: sites
last_reviewed: 2026-11-05
purpose: Define the sites module contract
---

# Sites Module

## Responsibility

Define metadata for PocketHost-owned sites and future deployment versions.

## Inputs and outputs

The P3 candidate has one allowlisted ID, `pockethost-demo`, and two built-in static HTML versions. Switching versions and rollback never accept arbitrary uploads or paths. The metadata/ownership record is separate from the served `index.html`. Site actions are intentionally gated behind a disabled-by-default, local DEV feature flag.

## P4 catalog-only PhotoMap TEST

The imported `photomap-test` is a separate owned filesystem snapshot in `~/Projects/PocketHost-Managed`, not the P3 `pockethost-demo` instance. The `/managed-projects` page shows its verified copy, release and inventory. Launch, autostart, dependency mutation and rollback remain disabled while the external Debian PRoot environment is not snapshotted. See [ADR-0008](../adr/0008-photomap-p4-managed-catalog.md).

## Forbidden

Do not import/adopt IleStoi.pl or mutate discovered document roots.

## Quality

Tests cover path confinement, metadata validation and rollback once enabled.

## Acceptance state

Native Termux tests for ownership, path rejection and version rollback passed, and the owner separately confirmed actual MacBook Chrome display of the P3 admin and v1 demo page through the trusted-LAN gateway on 2026-11-06. Browser write-button interaction and P3 release merge remain pending. This is an isolated demonstration site, not a publicly hosted service.

## One-step rollback contract — 2026-11-06

The owner verified that the MacBook controls published the demo version and rolled it back, but reported that repeatedly clicking Rollback flips v1 and v2 forever. Audit found that the old host adapter intentionally swapped `contentVersion` and `previousVersion`, creating a misleading undo/redo loop.

The proposed P3 correction is **single-use rollback**: a successful rollback restores the immediately prior sample version and sets `previousVersion=null` / `canRollback=false`; another rollback returns the existing typed no-prior-version error without touching the served content. A new explicit `Switch sample version` publish establishes a new rollback opportunity. The UI keeps the rollback control visible but disabled when unavailable. The sample publish toggle is deliberately limited to the two bundled demo documents; arbitrary version history and redo are deferred beyond P3.

This source change is **not** an on-device deployment or a browser validation by itself. Run the exact Termux native gates, verify real panel behavior after a guarded release, compare the six existing services, and keep `main` unchanged until acceptance.

## Explicit demo version selection — candidate, 2026-11-06

To remove the confusing perpetual v1/v2 toggle reported from MacBook Chrome, the P3 UI now proposes a **Target version** dropdown containing exactly the two built-in demos, followed by **Publish selected version**. The server exposes only the fixed no-body DEV action routes `publish/v1` and `publish/v2`; it rejects arbitrary filenames, paths, versions and command inputs. Publishing the currently active version is a no-op and does not create a fake rollback entry.

**Rollback remains distinct:** it undoes the last successful different-version publication once, then is disabled until a new explicit publication. This is an isolated PocketHost-owned test site, not general-purpose version history or upload support.

This code is a **candidate**, not deployed merely by committing it. Native Termux full quality gates, controlled panel update, independent service checks and Mac browser verification are required before the current running behavior can be considered changed. IleStoi and the six existing monitored services must remain untouched.
