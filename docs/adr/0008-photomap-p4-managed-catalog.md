---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-06
purpose: Limit the first managed PhotoMap MVP to a verified read-only catalog until process and dependency isolation are independently proven
---

# ADR-0008: P4 managed PhotoMap catalog MVP

## Decision

The first P4 slice adds `photomap-test` to the PocketHost panel as an **explicitly imported, non-running managed project**. The only data source is the sealed `PocketHost-Managed` registry, current release selection, instance/runtime/package manifests, source release and data inventory. No directory discovery, arbitrary project ID, generic file access or user-supplied command is accepted.

A fixed loopback DEV `GET /api/v1/managed-photomap` endpoint reads validated owner `pockethost`, schema `1`, instance `photomap-test`, consistent release, disabled launch/autostart and unenabled package mutations. Invalid ownership or inconsistent manifests yield an unavailable response; no repair or adoption is attempted. The endpoint does not return absolute filesystem paths, source contents, secrets or process identity.

The `/managed-projects` admin page shows source release, copied database and media counts, read-only tool availability/version and checksums of preserved project-local lock files. The existing `/host`, `/owned-site` and original template routes remain unchanged. All 6 external monitored services stay observed-only.

## Why runtime activation is not part of this slice

PhotoMap was imported with an `external-unfrozen` Debian PRoot environment. There is **no verified isolated Python image, launch environment, process-identity marker or all-data rollback restore point**. The snapshot's existing `runtime.json` has `launch_allowed=false`, `enabled=false` and `autostart=false`. P4 deliberately does **not** bypass these authoritative flags, write a runit registration, open port 8010, start PhotoMap, install packages or claim a functioning rollback.

The P3 static site demo is a separate owned runtime and must not be repurposed into PhotoMap process management. The production PhotoMap on Raspberry Pi, IleStoi.pl, tunnel and Local Agent are not eligible targets.

## Extension interfaces

- `src/shared/managed-project.ts`: fixed typed snapshot and `ManagedProjectPort` for future adapters.
- `src/modules/host/managed-photomap-host.ts`: exclusive bounded filesystem inspection.
- `apps/admin/vite.config.ts`: same-origin, localhost-only GET transport, no write route.
- `apps/admin/src/app/managed-projects/page.tsx`: accessible managed project display, with capability flags reflecting actual gates.

A future independently approved runtime ADR may add exact PhotoMap CLI/image snapshot, versioned project dependencies and owned PID/start-ticks verification plus safe start/stop after on-device acceptance. Future update/rollback cannot be enabled until data, dependencies and migrations have tested restoration.

## Acceptance and deferred release

**Design/source accepted** at P4 source `471fdfecfa8bf41f52ef1db198959ba94857c2ac`: native Samsung `pockethost-p4-closeout-final-native-quality-20261106-v1` completed done/exit 0 with 51/51 Node tests, root docs/format/lint/types, admin lint/build and 6/6 UI tests. `pockethost-p4-closeout-real-import-adapter-20261106-v1` independently inspected actual imported PhotoMap data and returned done/exit 0 (one owned release, 2,196 media files, six tools, four lock hashes, no mutation capability). Obsolete v1 staging was removed under a separate exact-path guarded receipt. PhotoMap remains stopped without runit registration or autostart; six unrelated services were observed running in a separate preflight.

**Live UI deployment is not yet accepted.** The current P3 panel was left intact. A separate gated update must verify the real catalog JSON GET, POST 405, forged Host/Origin 403, preserve P3 ownership and the six external services, and have a proven rollback. This ADR does not authorize PhotoMap Start/Stop, package installation, a global update or whole-instance rollback. See [P4 checkpoint](../checkpoints/2026-11-06-p4-managed-photomap-catalog.md).
