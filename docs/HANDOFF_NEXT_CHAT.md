---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Canonical next-chat entrypoint for PocketHost Observability O1
---

# PocketHost — next sprint: Observability O1

## Mandatory start

Repository `MichalMatu/PocketHost`, **fresh main**.
Read root `AGENTS.md`, [runbook](LOCAL_AGENT_TERMUX.md),
[roadmap](ROADMAP.md), [module boundaries](MODULES.md),
[architecture](ARCHITECTURE.md),
[ADR-0010](adr/0010-read-only-observability.md)
and [quality gates](QUALITY_GATES.md).
Continue only on `main` without new branches or
force push. All project execution, dependencies,
tests and builds run exclusively on the precisely
verified Samsung Termux Local Agent via private
`agent-control` transport. No GitHub Actions,
Codex, Work or Mac/Linux fallback.

## Verified code baseline

At `bc5e5539ca4656e59077335b71c0875f967ea859`,
Samsung receipt
`pockethost-claim-final-clean-native-gate-bc5e55-20261107-v1`
returned done/0: `check:all` with 101/101 Node,
16/16 Vitest, lint, types, format and build PASS;
line coverage 80.34%. Separate task
`pockethost-p3-owned-live-reversible-api-acceptance-20261107-v1`
verified real owned P3 Publish/Rollback/Stop/Start,
HTTP and six foreign-service invariants.
PhotoMap port 8010 remained closed.
[Final accepted receipt](checkpoints/2026-11-07-final-native-qa-handoff.md).

Do not transfer these results to newer HEADs.

## Outstanding documentation QA

Documentation commit `dcebf14` passed structure,
documentation and Markdownlint but failed Prettier
on `README.md`, `docs/DEVELOPMENT_PLAN.md`
and `docs/checkpoints/2026-11-07-final-native-qa-handoff.md`.
A separate bounded Termux formatting-diff task
`pockethost-docs-prettier-diff-dcebf14-20261107-v1`
was submitted; its terminal result was not confirmed
at preparation of this handoff. Read the result,
finish any formatting correction and validate the
current exact commit, without blindly replaying work.

## O1 scope

Deliver tested, read-only vertical slices:

1. **Host Monitor:** CPU, RAM, disk, battery/network
   if accessible, plus current service state.
2. **Process Inspector:** process tree, resources,
   PID/start ticks, verified owned vs external/unknown.
3. **Runtime Diagnostics:** bounded, sanitized
   start/stop/crash/timeout/orphan/recovery history.
4. **Package Inventory:** installed Termux, Node/npm
   and Python versions and safe update metadata.
5. **Dashboard:** history charts, states and alerts.

A new `observability` module is registered as a
**planning/contract shell only**. Reuse current
`host`, `runtime`, `diagnostics`, `packages`
and `apps/admin` code rather than duplicate
process lifecycle or shell control.

## Unchanged release blockers

- Real P3 browser click, keyboard/ARIA
  Publish/Rollback acceptance still missing.
- PRoot detached/reparented orphans and unknown
  claims need safe physical recovery proof.
- PhotoMap TEST remains disabled; no approval for
  live Start, original data mutation or autostart.
- Knip native resolver fails on Termux; no
  dependency pruning based on this audit.

No mutation of IleStoi.pl, original PhotoMap,
Local Agent, foreign services or package estate.
Do not enable public ingress or automatic repair.

## First operations in next chat

1. Fetch fresh main, confirm exact current
   Samsung Local Agent identity, pending results,
   independent checkout cleanliness and six services.
2. Fix any documentation formatting gate failure.
3. Implement **O1.1 Host Monitor** with real
   read-only device capability measurements,
   proper unavailable states and negative tests.
4. Deliver **O1.2 Process Inspector** if O1.1
   reaches native QA; otherwise document exact
   blockers and leave a clean next step.
5. Record exact source SHA, task IDs, exit codes,
   unchanged protected services and updated
   roadmap/checkpoint. No invented PASS.
