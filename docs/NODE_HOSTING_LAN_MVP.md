---
status: accepted-with-follow-up
owner: host
last_reviewed: 2026-11-22
purpose: Current private-LAN Node owner API contract and scoped A8 acceptance
---

# Node.js Hosting — private owner MVP

## Scope and trust boundary

`/projects` manages only PocketHost-created Node projects. All writes and
private source/preview reads under `/api/v1/node-projects` require an owner
secret. The browser sends `X-PocketHost-Node-Owner`; the server compares it
in constant time with `POCKETHOST_NODE_OWNER_TOKEN`. The header
`X-PocketHost-Intent: owned-node-project` and same-origin checks are
additional request checks, **not** authentication. No token is returned by the
API, persisted by the editor, or committed to Git.

On the verified A8 DEV runit panel, the launcher activates Node Hosting
only if `~/.local/state/pockethost/node-owner-token` is a regular, owner-owned
file with mode `0600` holding exactly one 32–128-character URL-safe token.
It disables Node when the token is missing or invalid without affecting
Static Hosting. This private token must be generated on A8, read **locally**
in Termux to unlock the browser, and never sent through Git, logs, the
dashboard, or this chat. It is not a sandbox boundary: trusted user Node
code runs with the same Termux UID and could read its owner's files.

The launcher enables the following server-side variables only after that
file is verified (never use `VITE_*` variables for secrets):

- `POCKETHOST_ENABLE_OWNED_SITE_DEV=1`
- `POCKETHOST_ENABLE_NODE_HOSTING_DEV=1`
- `POCKETHOST_ENABLE_NODE_RUNTIME_DEV=1`
- `POCKETHOST_ENABLE_NODE_DEPENDENCIES_DEV=1` if the trusted app needs npm packages
- `POCKETHOST_ENABLE_NODE_BUILD_DEV=1` if the trusted app needs a build
- `POCKETHOST_NODE_OWNER_TOKEN=<random 32–128 URL-safe characters>`

Generate the token on the owner's **trusted A8 device** and keep it outside
the repository and logs. A verified local provisioning operation may create
it atomically with owner-only permissions; read it directly in Termux, for
example `cat ~/.local/state/pockethost/node-owner-token`, only on a trusted
screen. Any activation occurs on the next separately guarded DEV panel
restart and never enables WAN, SSH, external service control, or arbitrary
project execution without an authenticated and reviewed owner action. If unset or malformed, **all Node mutations are denied**;
read-only inventory remains available. To confirm configuration without
revealing the token, use `GET /api/v1/node-projects/owner-session`:
`{ "configured": true|false, "authorized": true|false }`. The browser stores
the token only in the current tab's React state and clears it on Lock/unmount. Lock or token edits also discard all previously checked one-shot approvals and review state; asynchronous verification for a superseded token cannot unlock the tab. Lock does not revoke the host-configured token globally—rotate that token in the private panel environment to revoke access across tabs.

The LAN gateway retains its exact private interface and origin policy;
there is no WAN port or public Node ingress. A credential transmitted over
plain HTTP is **not confidential against devices on the same LAN**. Only use
this owner flow on a trusted private network; do not expose it over a public
network. The Node process runs with the **Termux UID**, not in a sandbox.

## Existing implementation reused

The editor stages `package.json`, `package-lock.json`, `server.mjs`, and
bounded optional frontend files or assets; local-folder and pinned public
GitHub imports are supported. `NodeProjectHost` retains immutable candidates,
revisions and integrity checks; `NodeDependencyPreparer` and
`NodeBuildPreparer` prepare packages/build artifacts only after explicit
approval; `NodeRunitHost` owns local runit processes, port allocation,
release identity, readiness nonce, logs, stop/start and rollback.

Expected flow:

1. Unlock owner access at `/projects`; create a project.
2. Edit/import trusted source; validate and stage immutable candidate.
3. Review dependency/build plans; explicitly approve any npm install/build.
4. Review plan, approve execution, deploy; host verifies loopback HTTP
   `/__pockethost/ready` with nonce. Review local address, readiness and logs.
5. Change source, stage next candidate, prepare and deploy update.
6. Review rollback and restore the previous verified good release; or stop.
   Unknown PID/ownership, source integrity and readiness fail closed.

The panel reports the local loopback address
`http://127.0.0.1:<allocated-port>/`. This is reachable **on the A8 only**
unless a separately authorized ingress design is implemented. It is not a
WAN or laptop-browser URL.


## Mutable application data — scoped implementation boundary

`NodeProjectDataScope` inspects a separate private directory under `~/.local/state/pockethost/node-project-data/<owned-node-id>` with fixed `uploads/`, `db/` and `state/` categories. It rejects unknown entries, links, permissive ownership, over-budget files and nested paths. This is **read-only inventory and scope validation**: it neither creates data roots nor captures a database-consistent backup or restores any application data. The existing source Restic backup remains separate, and no runtime environment variable is enabled for mutable backups. The separate private read-only inventory API is enabled; restore operations remain unavailable. A future staged restore requires explicit offline/consistency verification and separate approval.

### Offline snapshots (deployed source, API disabled)

`NodeProjectDataSnapshots` provides detached local offline-only snapshots and restore-to-staging for private `uploads/`, `db/` and `state/` data, with SHA-256 manifests. Schema v2 retains/checks empty directories, and schema-v1 file-only manifests remain readable. Latest A8 deployed code `9b910d8dc353c512333b290a6749c60ad3df530f` has `format,structure,boundaries,root-lint,root-types,node,syntax` scoped QA PASS including Node fixture tests; receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`. This is **fixture-level assurance only**, not an authoritative offline database consistency proof. No live data backup/restore, API/UI mutation endpoints, scheduled jobs or off-device data transfer was performed. Staged recovery never overwrites live files.

### Read-only runtime eligibility and project data inventory

An owner-authenticated `GET /api/v1/node-projects/:id/data-scope` returns the independently checked project ID, storage state, file count, total bytes and fixed recovery-disabled/offline-required flags, plus a **read-only** observed owned-runtime state and blocking reason. Inventory is also broken down by `uploads`, `db`, and `state` with per-category file counts, byte totals, and directory counts (including empty directories); no filenames or contents are returned. `/projects` displays these when the owner explicitly clicks **Inspect data storage**. The request does **not** enumerate file names or read file contents, create directories, run backup/restore, or mark the app database consistent. Owner lock/project selection invalidates the displayed result. The UI now also shows a read-only recovery checklist: owned storage, owned stopped runtime, database consistency (always requiring a separate manual proof), and a one-shot snapshot approval (never granted by inspection). No action or unlock is implied by an observed stopped state. A stopped-state observation is advisory only, not an atomic database checkpoint or permission to back up; unknown, running and not-provisioned states remain blocked. The runtime review code is now guarded-deployed on A8 under `6e7601f` with no functional QA. Snapshot creation and staging restore are not API-exposed. An owner-only read-only `GET /api/v1/node-projects/:id/data-snapshots` now indexes local detached snapshot manifests only for the selected project (timestamp, file/byte/directory counts and schema). Missing snapshot storage returns an empty list without creating directories. The index explicitly reports `metadata-only` and `integrity: not-checked`: it does not hash archive contents or establish a usable backup. Detached snapshot list/verification validate project identity against the owned project catalog, **not** against currently available mutable data; they remain accessible when the live data folder is missing or damaged. The Projects view fetches the live-data report and detached snapshot index independently, so a 409 or invalid scope report cannot suppress a valid detached index; either failed read shows a distinct warning, never a false empty-state. Snapshot creation still requires independently verified and provisioned private data. An owner-authenticated read-only `GET /api/v1/node-projects/:id/data-snapshots/:snapshot/verify` checks existing stored file SHA-256 digests and, for v2 manifests, the directory inventory without creating or restoring files. The Projects UI offers an explicit per-snapshot **Verify stored bytes** action; a successful comparison is not database consistency certification or permission to restore. Client-side verification also requires the returned snapshot ID and file/byte/directory totals to match the selected manifest metadata; mismatches are reported as unverified, not successful checks. This path awaits exact-SHA QA and authoritative offline consistency integration.

## Original parallel sprint contract (historical)

Only `/api/v1/node-projects` gains `GET /owner-session` and owner-token
access checks. Existing response shapes and successful operation paths remain
unchanged. Shared `lan-gateway.mjs` changes only the timeout budget for
`/api/v1/node-projects` (up to five minutes for install/build, one minute
for lifecycle, 90 seconds for GitHub import, 30 seconds for reads/other).
No `/sites`, `/deployments`, `/runtime-logs` or `/hosting` changes.

## Verified scope and remaining acceptance

The verified Samsung A8 trusted Node fixture previously completed owner-token
negative access, Create → Stage → Deploy → HTTP/Logs → Update → Stop/Start →
Rollback under its recorded exact SHA. The later `96c2879` source/asset backup
fix was guarded-deployed, with separate scoped QA at `73b2da8`. **Neither**
evidence set establishes full latest-browser sign-off, generic independent
project data recovery, untrusted-code isolation, full G2 or G3. See the
[current checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md)
and [MVP acceptance](MVP_EXECUTION_PLAN.md). No build, app execution or QA
is implied by this document refresh; new physical/device or automated test
runs require separately scoped owner approval.
