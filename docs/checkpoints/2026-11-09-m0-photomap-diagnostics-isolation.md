---
status: source-implemented-qa-pending
owner: core
last_reviewed: 2026-11-09
purpose: Record the independent legacy PhotoMap diagnostics source slice and native QA acceptance status
---

# M0 — isolate legacy PhotoMap diagnostics

## Scope and source decisions

Continues the [M0 UI/System separation sprint](2026-11-09-m0-implementation-ui-separation-sprint.md) and
[upstream-first roadmap](../ROADMAP.md). Work started from
PocketHost `main@4cb4f640050649dfbcd6a10cd32db4e682e650e3`
after checking the earlier native H2 UI receipt. Changes
committed directly to `main`; this is source work, **not**
a deployment or an automatically healthy live system.

Previously, the general O1 endpoint
`GET /api/v1/observability` constructed the fixed
`ManagedPhotoMapRuntimeHost` and read a PhotoMap-specific
`events.log`. That contaminated generic system monitoring
with a legacy application instance. Global O1 now emits
an **honest unavailable diagnostics state** with no
PhotoMap events until a general service-owned events
source exists. It still reads the same host/process,
network and package observations.

PhotoMap retains its explicit compatibility API
`GET /api/v1/managed-photomap`; an additional read-only
`GET /api/v1/managed-photomap/events` now returns
`{ state: "ok" | "unavailable", events: [...] }`.
The route preserves the existing loopback-only Host,
Origin, same-site and HTTP GET constraints. Only
the existing fixed PhotoMap TEST path is read, using
the existing `ManagedPhotoMapRuntimeHost.readLogs()`
guard and a separate `readLegacyPhotoMapEvents`
sanitizer. No arbitrary user-supplied target, PID,
path, service action, process control or package
operation was added.

The legacy `/managed-projects` screen now has
an explicit **Inspect events** button and a strict
Zod schema. Only timestamp, fixed `photomap-test`
instance ID and approved event codes are displayed;
unknown/foreign events or raw log messages are
rejected. Missing/unsafe logs report `unavailable`
instead of fabricating success. Nothing is read
in the background through general observability.

## Changed source and planned verification

| Source area                                              | Outcome                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/modules/host/photomap-legacy-events.ts`             | Fixed-instance, bounded pure sanitizer with fail-closed result            |
| `apps/admin/vite.config.ts`                              | Legacy GET events route; O1 no longer imports PhotoMap event data         |
| `apps/admin/src/lib/managed-photomap-schema.ts`          | Event shape and code allowlist, unavailable/empty invariant               |
| `apps/admin/src/app/managed-projects/page.tsx`           | Explicit read-only inspection UI                                          |
| `tests/quality/photomap-legacy-events.test.mjs`          | Source boundary, zero effects, foreign/secret event and unavailable cases |
| `apps/admin/tests/managed-projects.interaction.test.tsx` | User-triggered GET-only path and refusal of invalid data                  |

The source test's endpoint regex was corrected in
`2aaf78e962367f560595b28398c7f11737da082d`;
prior candidate `a4b2a1147ae92971fcd62c1a8df3c70ad1f3767b`
does not inherit that fix. Native receipts must
refer to the exact tested SHA.

## Samsung native quality evidence

Two unique, source-pinned Local Agent QA task IDs
have been published under the verified S22
`android-termux-10520` installation, in an
**isolated PocketHost QA checkout**. They perform
only source/contract/unit/UI/lint/build/format
checks and do not operate the live admin panel,
external services or installed packages:

- `pockethost-m0-photomap-decouple-native-s22-a4b2a114-20261109-v1`
  — earlier source snapshot; intentionally
  **superseded** by the regex repair.
- `pockethost-m0-photomap-final-native-s22-2aaf78e9-20261109-v1`
  — final corrected source candidate.

**At this checkpoint's initial publication the
terminal receipts were not yet available. Native
test status remains OPEN, not PASS.** Read actual
result objects from Local Agent `agent-control`,
do not republish either task, and distinguish
source checks from physical panel deployment.

Historical H2 asset-relocation QA receipt
`pockethost-m0-asset-relocation-native-s22-15eb7fa5-20261109-v1`
was already done/0: 13/13 UI, root route checks,
TypeScript, admin ESLint and changed-file format
PASS on its exact earlier SHA. This does **not**
certify the newer PhotoMap code.

## Hard noninterference and remaining scope

- **No change** to H2 release state, active
  sites or owner PID/start-ticks.
- **No change** to PhotoMap PRoot launch
  permissions, port, imported copy or data;
  it remains disabled.
- **No change** to IleStoi, Local Agent, SSH,
  Cloudflare, runit registrations, DNS, backup,
  secrets or public routes.
- Legacy P3 demo/PhotoMap GET inventory routes
  still exist. Existing code-specific tests
  remain protected by compatibility.
- **Still open for M0:** `SERVICE_CATALOG`
  in `src/modules/host/host-snapshot.ts`
  contains fixed IleStoi/service labels.
  Migrate to generic read-only Termux
  observations only with schema/client
  compatibility and no inherited management
  authority. The P3 Vite route remains legacy.
- **Not M1/M2/M3:** persisted project ownership,
  shared runit recovery, backup/restore contracts
  and Node.js Hosting MVP are separate gates
  and not implemented by this patch.

**Verdict:** PhotoMap/O1 source dependency
isolated; native acceptance and full M0 closeout
remain OPEN until terminal evidence is checked
and applicable regression gates pass.
