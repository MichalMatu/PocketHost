---
status: in-progress
owner: core
last_reviewed: 2026-11-07
purpose: Isolated H3 Termux Center implementation, evidence and safety contract
---

# H3 — Termux Control Center (parallel feature branch)

## Ownership and branch

The owner explicitly requested a separate branch because other work
continues on `main`. This overrides the usual main-only policy only
for H3 work. Branch: `feature/h3-termux-control-center-20261107`,
created from `2c4a9d9da29d7f7b60153701a503ad1a8b7af552`.
Do not fast-forward, merge, deploy, rebase or force-update `main`.

## Owner change: no password gate

The owner requested operational controls without waiting for login/auth.
H3 now includes typed package refresh/install/remove/upgrade, a managed
workspace file editor with create/rename/delete, existing owned-site
start/stop/restart, and reversible workspace snapshots. Each write
requires a deliberate UI confirmation, not a login. The trusted-LAN
session remains unauthenticated and must not be opened to WAN.

## Implemented source candidate

- **Packages:** reuse existing O1 read-only dpkg/npm/pip inventory,
  bounded package search and explicit cached/unverified upgrade hints.
- **Services:** reuse existing runit allowlist/status and external-owner
  classification. No service signals or process adoption.
- **Files:** new bounded, exact-site-owner and active-release-only
  enumeration through `SiteFleetHost.listActiveFiles` and a GET-only
  `/api/v1/sites/<site-id>/files` endpoint. No general path input or
  content reading. Reject symlinks and out-of-budget assets.
- **Backups:** reuse existing immutable release metadata, labelled
  explicitly as **not independent backups**. Detect fixed optional tools
  (Restic, ttyd, cloudcmd, Termux:API) through stat-only executable
  inspection on `GET /api/v1/termux-tools`. Never spawn or install them.
- React route `/termux` exposes four tabs with distinct errors and
  read-only actions. Existing routes, site upload/restore and UI layout
  remain intact. No new npm dependencies are introduced.

### Current H3 branch capabilities

The source now also provides a full bounded Termux dpkg inventory (up to
700 entries) and native apt-cache package search, rather than relying only
on the O1 dashboard's short sample. The Packages tab offers an apt
simulation before confirmed apt operations. The Files tab has a bounded
user-owned workspace with import/export, copy, text edit, rename and
delete. Backups gain SHA-256 integrity verification; failed checks
prevent Restore. The Services tab lists discovered runit units and
allows an explicit registration of an exact non-protected unit before
its typed Start/Stop/Restart, plus independent H2-own-site controls
and logs. The six protected service names and their symlink aliases
are not manageable through the new runit API.

All additions remain in an isolated feature branch with test-only
state mutations. No real apt transaction, service signal or backup of
production files was executed.

### Candidate upstream integrations

- Cloud Commander: MIT, large Node dependency chain. Reuse its
  filesystem patterns or selected middleware under an explicitly
  chosen scope; no password gate is required for implementing H3.
- CodeMirror 6 and Uppy: integrate into the owned file editor when useful; no login dependency is required.
- Restic: BSD-2-Clause CLI; integrate as a separately approved,
  noninteractive external process with secret-safe repository config.
- ttyd: MIT; keep separate from the general admin API; do not open an arbitrary network shell.
- Termux-services: use installed runit CLI without copying GPL-3 code.

## Guardrails and acceptance

The owner explicitly removed the proposed password prerequisite. Do not
reintroduce a login dependency or disable controls merely because
authentication is absent. Existing strict HTTP Origin/Host checks and
confirmed typed operations remain in place.

Only the explicitly owned H3 scratch workspace can be edited; existing
two H2 user sites, six protected foreign services, PhotoMap and Local
Agent are excluded from this new code. H2-managed sites may be
started/stopped/restarted through their existing verified owner API,
but no live service action is performed by this sprint. Termux package
mutations are real apt-get commands when explicitly triggered in H3;
they are **not** executed by tests or on the current live panel.

Full `npm run check:all` must run on the exact H3 source SHA, exclusively
on the verified Samsung Local Agent and isolated QA checkout. Isolated
fixture tests may write only their own disposable directories.
Before any live rollout, fresh process/service/site ownership preflight
and separate live acceptance remain necessary. No live H3 deployment.

## H3.2 extension — packages, files, services, backups

Owner-approved password-free operations are now supplemented by:

- Native `apt-get -s` install/remove/upgrade simulations before optional
  package mutations. No duplicated dependency resolver.
- Import/export of bounded binary files (128 KiB), server-side copy,
  and browser controls for the H3-owned workspace, with relative paths,
  no hidden/symlink traversal and no general host shell API.
- SHA-256 manifest integrity for new workspace snapshots, an explicit
  Verify button and refusal to restore corrupt snapshots.
- On-demand owned static site logs in the Services tab through the
  pre-existing bounded H2 API; external runit services remain observed
  rather than adopted.
- Dedicated native negative tests and Vitest UI interaction tests.
  
These operations require no password, but still use deliberate confirmation
and exact targets. No install, global backup, service mutation or live H3
deployment is performed by this development sprint.

## Evidence

First isolated native H3 task
`pockethost-h3-isolated-branch-native-g2-8e3d7c-20261107-v1`
returned FAILED due missing checkpoint archive index entries (including
a concurrent H2.1 checkpoint). It did not reach code tests. Both links
have now been added on this branch. New exact-source tests are required.

Second native H3 QA task `pockethost-h3-admin-qa-88ece8a-20261107-v1`
returned HOLD: the requested branch HEAD moved during implementation.
This is a stale branch-tip check, not evidence of a code failure. Future
QA must fetch the moving branch, validate the *pinned* candidate SHA as
an ancestor, and test a detached checkout of that exact SHA.

Native pinned-SHA H3.2 QA task
`pockethost-h3-next-sprint-native-g2-2f8ed18-20261107-v1`
returned OPEN: 136/138 Node tests passed. The two failures were
a stale route count in admin preservation and unsupported TS constructor
parameter properties in Node's strip-only TypeScript loader. Both
were fixed in the next source revision.

Native diagnostic matrix task
`pockethost-h3-runit-native-diagnostics-8560b96-20261107-v1`
verified the selected SHA and reported 144/145 foundation tests
passed; remaining empty-directory deletion used the wrong fs primitive.
Vitest UI 38/38 passed. The matrix also found a React effect lint
issue, unused UI-test arguments, an omitted binary-upload request
type, and formatting drift, including three inherited main documents.
The functional issues were fixed on the feature branch. A fresh
exact-source full quality receipt is required. The matrix executed
in isolated QA and did not deploy H3.
