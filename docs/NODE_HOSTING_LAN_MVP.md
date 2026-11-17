---
status: proposed
owner: host
purpose: Node.js private-LAN owner API contract and A8 acceptance
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

Configure the following server-side variables in the private, existing
PocketHost DEV panel environment on A8 (never use `VITE_*` variables for
secrets):

- `POCKETHOST_ENABLE_OWNED_SITE_DEV=1`
- `POCKETHOST_ENABLE_NODE_HOSTING_DEV=1`
- `POCKETHOST_ENABLE_NODE_RUNTIME_DEV=1`
- `POCKETHOST_ENABLE_NODE_DEPENDENCIES_DEV=1` if the trusted app needs npm packages
- `POCKETHOST_ENABLE_NODE_BUILD_DEV=1` if the trusted app needs a build
- `POCKETHOST_NODE_OWNER_TOKEN=<random 32–128 URL-safe characters>`

Generate the token on the owner's **trusted device**, and keep it outside the
repository and logs. If unset or malformed, **all Node mutations are denied**;
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

## Parallel sprint contract

Only `/api/v1/node-projects` gains `GET /owner-session` and owner-token
access checks. Existing response shapes and successful operation paths remain
unchanged. Shared `lan-gateway.mjs` changes only the timeout budget for
`/api/v1/node-projects` (up to five minutes for install/build, one minute
for lifecycle, 90 seconds for GitHub import, 30 seconds for reads/other).
No `/sites`, `/deployments`, `/runtime-logs` or `/hosting` changes.

## Acceptance pending device and test authorization

No source commit is physical acceptance. A8 must independently confirm the
owner token denial path, one trusted app's Create → Stage → Prepare → Deploy →
HTTP → Logs → Update → Stop → Start → Rollback and exact live SHA/ownership.
Do not deploy to the shared panel, trigger runit, execute a test suite, lint,
format, typecheck, smoke or QA without separate scoped owner approval. Keep
the running panel and other parallel checkouts unchanged.
