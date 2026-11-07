---
status: in-progress
owner: core
last_reviewed: 2026-11-07
purpose: Evidence and handoff for the full repository audit, narrow repair and native QA
---

# PocketHost — general repository audit and repair, 2026-11-07

## Starting state and scope

- Source: `main@437dd64662885caedfbc8b12a40b994c3d677a06`.
  The two remaining remote branches were `main` and
  the merged H3.4 feature branch; the feature tip
  `cc9f47a` is an ancestor of `main`.
- The repository was created on 2026-11-05. Thus
  requested 7/30/90-day comparisons all include
  the project's complete available history.
- Source tree inspection covered foundation scripts,
  typed host/runtime/site modules, admin template
  routes, unit and UI tests, package manifests,
  deployment contracts, documentation and ADRs.
  This is static inspection, not an assertion that
  every path is dynamically exercised.
- Preserve prior accepted H2/H2.1/O1/H3.4 device
  results and the pinned upstream admin template.
  No source branch, service change or package
  installation is authorized by this audit alone.

## Verified acceptance before this audit

- Exact H3.4 G2: source `cc9f47a`,
  `pockethost-h34-post-merge-native-check-all-20261107-v1`
  returned terminal `done/0 PASS`, including
  45/45 UI tests and all other `check:all` gates.
- Guarded G3: `pockethost-h34-guarded-production-cutover-e1c11e7-20261107-v1`
  returned `done/0 PASS` at installed source
  `e1c11e7`. Two user sites, their digests,
  six protected service states and PhotoMap
  TEST closed-port condition were preserved.
- Baseline documentation: `pockethost-h34-g3-docs-qa-437dd64-20261107-v1`
  returned terminal `done/0 PASS` for
  `check:docs`, Markdownlint and Prettier
  at `437dd646`.
- Later physical smoke:
  `pockethost-h34-postdeploy-physical-smoke-20261107-v1`
  returned terminal `failed/1`. It confirmed
  four LAN pages, five read-only APIs, two user
  sites, denied cross-origin write and a working
  isolated File Manager round-trip, but failed
  at Restic backup. The cause is unknown.
- Native Restic diagnostic, ttyd simulation,
  controlled ttyd installation and further
  physical acceptance have separately queued
  tasks; publication without a terminal result
  is neither PASS nor evidence of installation.

## Repairs and regression test in this audit

1. The Restic host adapter checks the returned
   `HostCommandResult.exit`. A nonzero value
   now throws a generic error, without exposing
   subprocess output to the typed API. The normal
   native `execFile` path already throws, but a
   custom runner returning nonzero was silently
   accepted before this fix.
2. A deterministic negative Node test exercises
   nonzero init, backup, snapshots and check.
   It uses a disposable fixture and does not
   run any native Restic subprocess.
3. Root README and active roadmap, gates and
   handoff now distinguish accepted H3.4 G2/G3
   from still-open recovery and new-source QA.

## Open gates and next action

- **Audit source G2 PENDING:** execute
  `npm run check:all` on the exact audit
  commit in the existing independent Samsung
  Termux QA checkout via Local Agent. Do not
  transfer old PASS receipts to the new SHA.
- **Restic G3 HOLD:** diagnose original backup
  failure using the existing pending disposable
  task result before new write tasks; then test
  complete backup/check/staged restore/digest
  on strictly disposable data. Never overwrite
  live HOME or PREFIX.
- **ttyd G3 HOLD:** inspect the preexisting
  apt simulation/installation receipts before
  requesting or replaying any installation.
  Physically test a single HTTP/WebSocket
  session and secure termination only when
  installed and separately approved.
- **Browser G3 HOLD:** real Mac Chrome File
  Manager, service-controls and H2.1 release
  interactions remain independent from jsdom.
- **Risk:** trusted-LAN administrative HTTP
  currently has no authentication by owner's
  prior explicit choice; it must never be
  advertised as a safe public API.
- **Risk:** PRoot orphan/reparented-child
  recovery and PhotoMap TEST activation
  remain outside this sprint and on HOLD.
- **Tooling:** existing structure, docs,
  boundaries, formatting, lint, typecheck,
  Node coverage, admin build and UI tests
  remain canonical. Knip resolver fails on
  Termux and is informational, not a prune
  or mandatory gate.

No production deployment is permitted solely
because this audit source is pushed. Record
the final audit commit SHA and terminal
Samsung result in a documentation-only
follow-up after verification. Source/hardware
claims remain limited to the evidence above.

## Next chat

Read `AGENTS.md`, `docs/LOCAL_AGENT_TERMUX.md`,
`docs/QUALITY_GATES.md`, this checkpoint and
`docs/HANDOFF_NEXT_CHAT.md`. Fetch fresh
`main` HEAD and exact Samsung agent-control
receipts. Finish only the unverified G2 and
pending physical Restic/ttyd/browser gates;
do not repeat previously accepted H3.4 QA,
touch foreign services, activate PhotoMap,
run GitHub Actions, or substitute Linux QA.
