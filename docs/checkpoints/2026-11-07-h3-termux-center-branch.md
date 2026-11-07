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

### Candidate upstream integrations

- Cloud Commander: MIT, large Node dependency chain. Reuse its design
  patterns and/or selected middleware only behind future scoped
  authentication, not its terminal or unrestricted filesystem access.
- CodeMirror 6 and Uppy: integrate into authenticated, owned file editor
  later; avoid adding them before a file-write contract exists.
- Restic: BSD-2-Clause CLI; integrate as a separately approved,
  noninteractive external process with secret-safe repository config.
- ttyd: MIT; deny access until a separately authenticated terminal
  channel exists.
- Termux-services: use installed runit CLI without copying GPL-3 code.

## Guardrails and acceptance

The live home-LAN admin is currently plain HTTP without login. H3 must
not expose an arbitrary path, shell, package mutation, file edits,
service control, Restic execution, public ingress or autostart.
No six protected services, PhotoMap or two user H2 sites may be
changed by development or tests. Do not switch the live H2 panel.

Run `npm run check:all` only on Samsung Termux via exact Local
Agent host+installation, isolated ordinary checkout, and capture
terminal receipt on the exact H3 branch commit. A passing G2 is
not live H3 deployment or Mac Chrome acceptance.

## Status

Source commit and native gate to be recorded after branch publication.
No device G3 request is made by this branch.
