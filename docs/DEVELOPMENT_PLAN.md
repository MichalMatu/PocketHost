---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Define staged delivery with phase gates
---

# Development Plan

## P0 — repository foundation (Gate 0 passed on Termux)

**Execution contract:** All PocketHost coding-command execution, dependency installation, compilation and validation run on Termux through the installed Local Agent (the existing host-command lane; no project binding required). The [fast-start runbook](LOCAL_AGENT_TERMUX.md) is the source for dispatch and evidence; no Mac/sandbox fallbacks.

Create docs index, ADRs, owner module instructions, manifest-controlled layout, guardrail tests, formatting/lint/type configurations and first checkpoint. No application code and no host modifications. **Exit:** Gate 0 passes and Gate 1 tooling is configured; lockfile/dependency verification tracked if registry unavailable.

## P1 — real Termux inventory (read-only)

Using Local Agent after permission and preflight, record sanitized existing service/network configuration. Build a host adapter behind a testable interface. **Exit:** discovery accurately reports IleStoi.pl without changing it, with failure-case tests and evidence.

## P2 — local GUI

The **full** ShadcnStore Vite admin template (32 routes) has been imported and compiled on real Termux, and its demo UI was started manually on `127.0.0.1:8787`. Keep **all** screens and a desktop-first single React GUI with native browser pinch zoom enabled. This is a **P2 visual/demo milestone, not integrated host administration**. Complete P1 read-only inventory and a loopback-only typed API, then connect the existing screens to live but non-destructive data. **Exit:** user can inspect actual server data and no external service can be stopped or modified.

## P3 — PocketHost-owned server

Introduce a new owned test site, separate port and explicit lifecycle management with tests for collisions, start/stop and rollback. **Exit:** own server operable without touching any existing production application.

## P4 — package catalog and assisted configuration

Add reviewed install plans, explicit approvals and safe diagnostics; installation is never implicit during discovery.

## P5 — AI deploy, domains and Android package

Add scoped publish API, site validation, version rollback, optional public ingress and packaging only after threat model, contract and device tests.

## Blockers

Termux Local Agent host-command capability and a native UI compilation are verified. The full vendor source is committed locally on the phone but GitHub push remains blocked by lack of write credentials; transfer/publish via approved Git transport without sharing credentials or running code builds on Mac. Root Gate 1, true browser gesture/a11y acceptance, Android-agent boot endurance, and authenticated read-only host API are not yet accepted.
