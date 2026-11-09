---
status: accepted
owner: host
last_reviewed: 2026-11-05
purpose: Define the exclusive Termux host adapter contract
---

# Host Module

## Responsibility

The only module that may interact with operating system processes, Termux tools and host filesystem APIs. It exposes narrow, typed capabilities to feature modules through application ports.

## P1 implementation: read-only fixed probes

`src/modules/host/host-snapshot.ts` implements a typed, sanitized snapshot. It probes only the explicitly registered Termux `runit` service names `wreckscanner`, `cloudflared`, `sshd`, `mosquitto`, and `ilestoi-healthwatch`. Each service is **externally owned**, and only `running`, `stopped` or `unknown` status is returned — never raw process output, PIDs, arguments, filesystem data or credentials. The adapter invokes the fixed `sv status` binary without a shell with a strict timeout and small output cap. P1.1 adds a sixth fixed service, the **Termux Local Agent**, using its separate private runit location; this does not create ownership or restart authority. The storage probe uses `statfsSync` **only for Termux home**, returning available/total MiB or `null` when inaccessible. No local filesystem paths or file listings are returned. Unknown service IDs are rejected before execution. Both real-device response and negative HTTP tests passed on 2026-11-05; see [P1.1 checkpoint](../checkpoints/2026-11-05-host-health-work-start.md).

The **development-only** Vite middleware `GET /api/v1/host/snapshot` is constrained to `127.0.0.1:8787`, blocks cross-origin requests, exposes no CORS headers and implements no write methods. The new `/host` page reads the snapshot using existing shadcn cards and badges while all 32 upstream demo routes remain intact. This API is not a production authentication design: do not expose it publicly or ship it in a production release. Future application-server packaging requires its own explicit auth/capabilities ADR.

## P4 owned PhotoMap catalog read boundary

`ManagedPhotoMapHost` reads only the hardcoded `photomap-test` manifest set under the dedicated owner-only `PocketHost-Managed` root, never scans for available sites. Before presenting inventory it checks canonical non-symlink directories, plain bounded JSON files, consistent schema/owner/instance/release, disabled runtime/autostart and forbidden package writes. Only sanitized allowlisted tool versions, relative lock paths and hashes, source release and copied data counts reach the browser. Inconsistent manifests fail closed with no repair.

This operation is **read-only** and does not confer authority to execute the imported Debian PRoot or old PhotoMap runit script. The P3 static demo and all six external monitored services keep separate ownership boundaries.

## Initial permissions

Read-only, allowlisted inventory probes with per-call timeout, bounded output and redaction. Explicitly represent unavailable tools and permission errors. No fallback to unrestricted shell.

## Forbidden

No arbitrary command strings, modification of existing service configuration, package installs, process kills or scanning user files without explicit future approval.

## Quality

Test allowlist rejection, timeout and error paths. No shell execution can occur in UI or other modules.

## P3 isolated owned-site candidate

The candidate `owned-site-host.ts` is the only adapter permitted to create and control a new fixed `pockethost-demo` instance beneath its dedicated `PocketHost-OwnedSites` root. Its loopback port is 18787, and its marker binds an instance UUID, executable script path, cwd, PID and Linux process start ticks. The API cannot supply paths, PIDs, ports or shell commands. The adapter rejects unverified process identity, port collisions and symlinked owned roots. This candidate is **not approved for live preview enablement** until physical Termux negative tests and rollback checks pass; all observed external services remain read-only.

## PhotoMap PRoot host adapter — disabled candidate

`ManagedPhotoMapRuntimeHost` is the exclusive filesystem/process boundary for a future project-local `photomap-test` Debian PRoot version. It checks fixed instance/release, non-symlink manifests and directories, disabled/autostart flags, version and requirements checksum, working database/media directories, port collision and exact PID + Linux start-ticks + executable/cwd/argv identity before any lifecycle signal. The adapter refuses a disabled real import and does not interact with the original PhotoMap service. Native Termux tests passed at `32c09f2c`; see [runtime checkpoint](../checkpoints/2026-11-06-photomap-runtime-inert-native.md).

**Updated staged acceptance:** independent versioned Debian rootfs copies and an owned disposable source/SQLite workset have now passed Samsung checks; a stopped Python 3.11.2 interpreter and all eight required packages were observed. At exact source `d5b5591`, **62/62** Node tests, **6/6** host negatives and root lint/types/format/docs passed. See [staging checkpoint](../checkpoints/2026-11-06-photomap-isolated-rootfs-python-qa-closeout.md). This remains **source plus inactive staging qualification**, not a health-tested PhotoMap process or a manual UI control. The candidate launch arguments now name the observed `/opt/photomap-venv/bin/python`, and additional profile approval fields reject staged/forged activation; **same-SHA Samsung source acceptance passed** at `a5443070`: 9/9 targeted and 65/65 root Node, docs/format/lint/types PASS, port 8010 OFF. No active version or profile permission may be enabled merely to pass a test. Failed/uncertain process identity must remain a HOLD, never a reason for PID-only cleanup.

## Host hardening and PhotoMap decoupling — 2026-11-07

The generic `managed-process-supervisor.ts` now owns bounded, fail-closed
start admission, identity/health readiness and Stop evidence policy.
`managed-proc-tree.ts` reads only an explicit leader's bounded /proc child graph,
records PID/start ticks and refuses unreadable or cyclic ancestry. Exact leader
identity, port release, observed descendant exit and process-group disappearance
are all required before clearing an owned PRoot marker. No forced group kill or
orphan adoption is permitted.

The generic `managed-proot-plan.ts` builds shell-free PRoot arguments from
allowlisted binds. Generic canonical file validation is in
`managed-runtime-files.ts`. PhotoMap's hardcoded source/release/profile,
Python guest, disposable SQLite and runtime arguments now belong to
`photomap-runtime-plan.ts`, separate from the process supervisor. This is a
source-only candidate; no live PhotoMap start was approved.

## O1 Host Monitor and Process Inspector — source candidate

The host-only `observability-probes.ts` adds an on-request 180 ms CPU delta
and reads fixed battery, network and filesystem data. Android restricted
counters have typed unavailable or permission-denied states; missing data
is not zero and no Android privilege changes are requested.

The Process Inspector walks at most 96 accessible numeric `/proc`
entries and returns only PID, PPID, start ticks, CPU ticks, optional RSS
and self/unverified classification. Kernel process name, command line,
working directory and private paths are never returned. A PID or a
process tree is not ownership evidence; no signal operation is exposed.

The installed Termux tool adapter executes only reviewed absolute
binaries with fixed arguments and bounded output. Native device read
availability and the exact final SHA are **not yet accepted**.
See [ADR-0010](../adr/0010-read-only-observability.md).

## H2.1 validated archive selection — source pending

The H2 host adapter adds selected historical
version restore, bounded immutable-release
inventory and opt-in deletion of an obsolete
archive. The exact site and release identifiers
are validated before any filesystem operation;
the active and rollback-target directories
are never deleted. Foreign or unknown process
identity continues to fail closed. An archived
GET preview never changes the active marker.

Samsung native and guarded device acceptance
remain required for this new application SHA.
See [H2.1 checkpoint](../checkpoints/2026-11-07-h21-release-manager-source.md).

## H2 owned static fleet — accepted on Samsung

The dedicated `site-fleet-host.ts` adapter manages only
explicitly registered `pockethost-h2` site markers.
It selects free ports from 19080–19095, creates up
to eight confined site directories, stores immutable
static releases, verifies each owned process with
PID/start ticks, cwd, approved script and instance
before Start/Stop/Restart, and reads bounded logs
and optional memory/uptime observations.

The small `site-fleet-server.mjs` process serves
strict static GET/HEAD assets from the active
owner-checked release. `site-fleet-proxy.mjs`
admits a private-LAN preview only for an
exactly verified running child. Unknown identity,
foreign port occupancy or malformed paths are
fail-closed; no foreign process is signalled.

Samsung H2 source G2 and two real-site ZIP/folder
LAN G3 passed at `750c4b3`; PhotoMap was not
started and all six protected services remained
running. See [H2 checkpoint](../checkpoints/2026-11-07-h2-static-hosting-source.md).

## M1 declarative registry file adapter — source candidate

The `hosting-registry-store.ts` file adapter is deliberately host-owned.
It stores only explicitly validated, versioned Hosting declarations in a
caller-supplied canonical private directory, using bounded atomic replacement
and exclusive locking. Validation is a pure shared contract, not a second
supervisor. An observed runit service or port is never auto-registered.
The refactored source still needs exact-SHA Samsung validation. No existing
H2 release directory, external service, or live panel is touched by this
source-only addition.

## M1 positive ownership diagnostic — source only

`hosting-service-ownership.ts` adds a pure consistency policy over a
validated M1 service declaration and externally collected host observations.
It requires the same private registry revision, explicit named runit
registration, identical canonical service target, non-protected running
observation, exact owner marker, and a match against PID, process start
ticks, executable, cwd and argv digest. Missing, stale or conflicting
fields return `unverified`.

The result is **not** permission to operate the service: probes and owner
markers must be independently trusted, and any future host lifecycle
adapter must re-attest the real process immediately before an action.
No existing runit service or registry was read or modified for this source
change. Native focused QA remains pending.
