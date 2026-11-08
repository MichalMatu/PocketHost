---
status: source-candidate
owner: ui
last_reviewed: 2026-11-08
purpose: Termux-first navigation and one visible File Manager
---

# UX/Architecture — Termux-first control plane

## Source and scope

- Based on main `c04355fd65d3a075295fb435c6ae39928070956f`.
- Main navigation groups: System, Hosting, Automation, Platform, Examples.
- Root is the system dashboard, and legacy `/termux` redirects to `/system`.
- Six independently addressable views: Packages, Files, Services, Backups,
  Terminal and Agents. Original upstream example routes remain accessible.
- Only one visible full File Manager uses existing HOME, PREFIX and shared
  adapters. The H3 workspace is a shortcut within HOME.
- Hosted-site release assets are read-only inventory, not a second editor.
- Legacy H3 workspace API remains backwards compatible for external callers;
  the duplicate WorkspaceManager UI is no longer mounted.
- No host adapter, runit service, running website, Local Agent installation,
  persistent task queue, public listener or production instance was mutated.

## Required acceptance

New UI source and regression tests are committed with GitHub Connector.
Exact-commit G0/G1/G2 Samsung QA is required for source acceptance.
Real Mac Chrome file navigation and any production G3 cutover are OPEN.
The existing production panel stays at its last accepted source.

## Next decision

After successful native QA, consolidate the legacy workspace backend
behind the one File Manager contract only with an explicit data migration
and no change to protected or externally owned directories.

## Owner-directed rapid review mode — 2026-11-08

The owner requested frequent private panel-only previews and faster code
iterations, with a full test and build matrix at the major closeout.
[ADR-0012](../adr/0012-private-ui-rapid-review.md) records the conditional
short-source gate and independent fail-closed production preflight. The
existing H3.4 accepted production source remains in place until a native
receipt proves an exact-SHA panel cutover. No full G2 approval is inferred.

## Later clarification — current DEV status

The owner clarified that PocketHost itself is **DEV code** and
refreshing/restarting only the verified PocketHost panel should be
routine, not an artificial production deployment blocker. The current
[DEV iteration runbook](../DEV_ITERATION.md) and
[ADR-0012](../adr/0012-private-ui-rapid-review.md) supersede the
earlier full-G2-before-each-UI-review wording in this checkpoint.
Historical accepted source/release evidence is preserved. No restart
is claimed without an actual device result.
