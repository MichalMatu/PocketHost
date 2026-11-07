---
status: source-candidate-device-qa-pending
owner: core
last_reviewed: 2026-11-07
purpose: Canonical O1 native acceptance and O2 implementation handoff
---

# PocketHost — O1 source MVP acceptance handoff

## Rules and starting state

Fetch the **fresh current main HEAD**, not a presumed SHA.
Read `AGENTS.md`, [Termux runbook](LOCAL_AGENT_TERMUX.md),
[ADR-0010](adr/0010-read-only-observability.md),
[roadmap](ROADMAP.md), [quality gates](QUALITY_GATES.md)
and [the O1 checkpoint](checkpoints/2026-11-07-o1-observability-source.md).

All source commits stay directly on `main` with expected-HEAD
non-force updates. All code execution, builds, tests and native
observations occur exclusively on verified Samsung/Termux Local Agent;
no Actions, Work, Codex, Mac or sandbox substitute.

## O1 functionality implemented in source

- `host/observability-probes.ts`: CPU delta, Android battery and
  network counters, 96-entry partial process view with start ticks,
  fixed shell-free installed packages and local cached update hints.
- `observability/overview.ts`: bounded in-memory history, alerts,
  strictly sanitized structured runtime event summaries and PID reuse
  checks. No persistent sampler or second process supervisor.
- `apps/admin`: GET-only DEV loopback endpoint,
  `/observability` route, sidebar entry, sample chart, processes,
  package inventory, service health, alerts, diagnostics. Does not
  enable public API or automatic recovery.
- Tests for missing permission, PID reuse, metadata rejection,
  history limits, foreign ownership and UI validation.

This is a **source candidate** until all checks and read-only live
measurements pass on the exact final SHA. Existing accepted baseline
`bc5e553` 101/101 Node, 16/16 UI, is not O1 validation.

## Samsung requests to reconcile

- `pockethost-o1-setup-native-docs-gate-9aa07b1-20261107-v1`:
  done/0, structure/docs/Markdownlint/format/boundaries/types PASS.
- `pockethost-o1-readonly-preflight-20261107-0301-v1`:
  invalid task timeout schema, **no execution**.
- `pockethost-o1-readonly-preflight-20261107-0304-v2`:
  read terminal result before claiming six-service/port evidence.
- `pockethost-o1-first-native-gates-19eaa36-20261107-v1`:
  fail-closed `main moved`; did not run tests.
- Await any final-SHA Samsung `check:all` and live metric receipts
  if submitted; never assume publication proves execution.

## Next actions

1. Confirm exact phone installation identity and pending task outcomes.
   Preserve all six existing services and PhotoMap port 8010.
2. Fix native TypeScript, lint, Prettier, unit, React build or schema
   findings on `main`. Do not silence tests or bypass quality gates.
3. On **immutable final main SHA**, run `npm run check:all` and a
   bounded real-device read-only collector acceptance through Local
   Agent. Capture task ID, exit code and real field availability.
4. If successful, verify actual React route and GET contract on
   loopback without starting PhotoMap or changing external services.
5. Expand diagnostic history and per-process CPU delta only after
   O1 native MVP is accepted; preserve existing runtime engine.

## Unchanged release holds

Real P3 Chromium Publish/Rollback keyboard/ARIA checks, detached PRoot
orphans and marker recovery, and live PhotoMap TEST Start remain
unapproved. No automatic recovery, arbitrary shell, package upgrades,
public API, persistent background agent or new Android permissions.
