---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Implementation ownership and acceptance plan for Observability O1
---

# PocketHost Development Plan

The [roadmap](ROADMAP.md) is the canonical milestone sequence.
This plan defines how to deliver the next vertical slices.
Use only fresh `main`, GitHub Connector and the exact
Samsung Termux Local Agent; never GitHub Actions,
Codex, Work or Mac/Linux PocketHost execution.

## Baseline

- **P0-P2:** read-only six-service monitor and admin
  baseline accepted.
- **P3:** owned demo HTTP Publish/Rollback/Stop/Start
  accepted on Samsung; real browser interactions HOLD.
- **P4:** read-only PhotoMap TEST catalog and copied,
  stopped workset; live PRoot runtime not approved.
- **Generic runtime:** registry, process supervisor,
  PID identity guards, PRoot source plan, typed APIs
  and recovery dry-run. Last complete native application
  QA: `bc5e553`, 101/101 Node and 16/16 Vitest PASS.
- **Prior documentation gate:** `dcebf14` passed
  structure/docs/Markdownlint, but Prettier flagged
  three files. Do not claim that commit fully green.

## Sprint O1 — functional vertical slices

1. **Host Monitor — `host`:** CPU delta, RAM,
   storage, optional battery and network, runit;
   timestamp, provenance, missing-data handling.
2. **Process Inspector — `host`:** bounded,
   accessible process tree and resource statistics,
   verified ownership evidence separate from observation.
3. **Runtime Diagnostics — `diagnostics` and
   `runtime`:** reuse structured JSONL events,
   error categories, bounded history and dry-run
   recovery decisions.
4. **Package Inventory — `packages`:** read-only
   Termux, Node/npm and Python versions; show
   available updates only with valid safe metadata.
5. **Dashboard — `apps/admin`:** metrics, graphs,
   real states and actionable but non-mutating alerts.
6. **Aggregation — `observability`:** validate
   and summarize admitted snapshots behind typed
   contracts. The registered source module is initially
   a **contract shell**, not a running collector.

For each meaningful slice: typed contract, negative
tests, exact-SHA Samsung source validation and real
read-only device observations. Close with full
`npm run check:all`, UI/browser checks where
available and a completed-vs-blocked checkpoint.

## Out of scope

No process kill/adoption, package installation/upgrades,
automated recovery, new persistent services, Shizuku
setup, public command API or PhotoMap live activation.
Preserve the six foreign services and current loopback
ownership boundary. Keep P3 browser acceptance and
PRoot orphan recovery as parallel release blockers.

See [quality gates](QUALITY_GATES.md),
[ADR-0010](adr/0010-read-only-observability.md)
and [next-chat handoff](HANDOFF_NEXT_CHAT.md).
