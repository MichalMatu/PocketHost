---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: H2 source, terminal Samsung tests, guarded LAN acceptance and next handoff
---

# H2 — multiple user-owned static sites on Android Termux

## Scope and preserved H1 rollback baseline

The owner approved one large H2 functional sprint: create multiple sites from
the browser, upload a ZIP or browser-selected folder, deploy updates, roll back,
start/stop/restart, inspect logs and resource statistics, and accept the
result on Samsung through a guarded release.

The accepted H1 application SHA `1edbd1b68cb1d0f4c21796172d25c5d0da10ebab`
is retained as the rollback baseline. H2 application source
`750c4b3fba2126647c3b593ae89d108ba2a67206` is now live after
exact-SHA QA and a guarded LAN switch on Samsung.

## Implemented H2 scope

- `src/modules/sites/site-bundle.ts`: bounded ZIP central-directory parser
  and folder-base64 decoder. Reject ZIP slip, archive symlinks, invalid
  compression, corrupt CRC, unsupported extensions, case-folded duplicates,
  unsafe names, oversized uploads and missing root `index.html`.
- `src/modules/host/site-fleet-host.ts`: explicit owner markers under
  `~/Projects/PocketHost-UserSites`, at most eight sites and an owned
  loopback port pool `19080–19095`. Each project has its own process
  PID/start-ticks record, health, logs and resource counters. No adoption
  of observed listeners or process names.
- `src/modules/host/site-fleet-server.mjs`: static-asset GET/HEAD only,
  bounded file reads, no dotfiles, path traversal, symlink following,
  directory listings, server-side commands or package execution.
- `src/modules/host/site-fleet-proxy.mjs` and `lan-gateway.mjs`:
  owner-record-verified **GET-only** private LAN preview route
  `http://<phone-private-ip>:18879/h2/<site-id>/` after exact running
  child verification. No new LAN listening port or WAN publication.
- `apps/admin/vite.config.ts`: serialized, separately feature-flagged private
  `/api/v1/sites` controls. Same-origin, loopback and deliberate intent
  are required for writes; no arbitrary host path, command, PID or
  port accepted from request bodies.
- `apps/admin/src/app/sites/page.tsx`: create, ZIP/folder import,
  publish/rollback, start/stop/restart, health, history, logs, file
  inventory and memory/uptime display. All upstream template pages remain.

Only static frontends and relative asset URLs are supported. No
backend program launch, arbitrary scripts, multi-user accounts,
package management or untrusted network exposure. The manually
enabled home-LAN administration endpoint remains HTTP **without
authentication**: only operate it on an approved trusted subnet.

## Resource limits and rollback

- 8 explicitly created projects; each has a distinct bound loopback port.
- ZIP input up to 6 MiB; unpacked site up to 8 MiB, 100 files and
  2 MiB per asset; no executable server payloads.
- Each deployment creates an immutable release folder. Switching the
  active marker is atomic; the previous release is retained as a
  one-use rollback point. At most 16 release-directory entries are
  admitted per site until a separately designed safe prune operation.
- Process mutations require exact project ID, marker, PID, start ticks,
  cwd, approved server script, instance and port. Unknown identity
  fails closed without signalling another service. No autostart.
- The six existing services and imported PhotoMap remain read-only
  and excluded from all H2 operations.

## Accepted native and LAN release evidence — 2026-11-07

**G2: PASS.** Local Agent task
`pockethost-h2-final-native-check-all-750c4b3-20261107-v2`
returned terminal `done/0` for application source
`750c4b3fba2126647c3b593ae89d108ba2a67206`.
The complete `npm run check:all` passed on Samsung,
including 26/26 admin UI tests, the Node suite and its
coverage gate, lint, TypeScript, format, docs and Vite build.
The isolated QA checkout was verified clean.

**G3: PASS.** Guarded task
`pockethost-h2-guarded-g3-real-static-sites-750c4b3-20261107-v2`
returned terminal `done/0 PASS`. Before any process change
it checked the old H1 source, PID/start ticks, exact Termux
worktrees, owner gateway record, current demo state and all
six protected services. The approved private-LAN preview
was switched to the exact G2-tested H2 application.

Real HTTP acceptance created **two separate user-owned projects**
with distinct loopback ports, uploaded a ZIP and a browser-folder-format
JSON bundle, started both processes, and served their HTML/CSS/JS
assets through the existing LAN site gateway. It then published
an updated ZIP, verified live content, consumed the single-use
rollback, rejected a repeated rollback, restarted the verified
owned process and read bounded logs. Rejection checks included
ZIP traversal, foreign Origin, missing write intent, private
owner files and POST on the static site gateway.

The task stopped both test processes, verified their owner
markers and closed ports, and removed **only its two own
temporary test projects**. The existing H1 demo was
preserved in the user's actual selected version (the initial
G3 attempt had safely held because it incorrectly assumed v2).
All six protected services remained running; PhotoMap TEST
port 8010 remained closed. No protected process or production
data was changed.

New LAN admin: `http://192.168.0.100:18878/sites`.
Private static previews: port `18879`, `/h2/<site-id>/`.
This is a manually started, trusted-LAN, **unauthenticated
HTTP** development capability. No WAN access, authenticated
multi-user hosting, server-side Node/Python execution or
package CMS is included.

## Remaining user/browser acceptance and future constraints

The owner should test **one actual ZIP or folder upload
through Chrome on Mac**, Start, open static site, update and
Rollback. Samsung G3 HTTP automation is not equivalent to a
user physically clicking every browser control. Full mobile,
keyboard/ARIA and negative-state testing remain a separate
quality follow-up, not a claim already proved here.

H2 currently permits up to eight projects and 16 release
folders per project; a controlled delete/prune UI and
storage-quota operations have not been implemented.
Uploaded sites should use relative asset URLs.

**H2 device release is accepted. Mac browser signoff remains pending.**
The H2 application SHA remains `750c4b3` even after
documentation-only follow-up commits.

See the [handoff](../HANDOFF_NEXT_CHAT.md), [roadmap](../ROADMAP.md),
[quality gates](../QUALITY_GATES.md) and [H1 acceptance](2026-11-07-h1-hosting-mvp-source.md).
