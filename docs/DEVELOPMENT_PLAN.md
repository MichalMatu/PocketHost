---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Define staged delivery with phase gates
---

# Development Plan

## P0 — repository foundation (current)

**Execution contract:** All PocketHost coding-command execution, dependency installation, compilation and validation run on Termux through the installed Local Agent (the existing host-command lane; no project binding required). The [fast-start runbook](LOCAL_AGENT_TERMUX.md) is the source for dispatch and evidence; no Mac/sandbox fallbacks.

Create docs index, ADRs, owner module instructions, manifest-controlled layout, guardrail tests, formatting/lint/type configurations and first checkpoint. No application code and no host modifications. **Exit:** Gate 0 passes and Gate 1 tooling is configured; lockfile/dependency verification tracked if registry unavailable.

## P1 — real Termux inventory (read-only; first vertical slice accepted)

Build and test the typed fixed-allowlist Termux host snapshot with `runit` service states for IleStoi.pl and surrounding external services. Integrate the new `/host` route into the existing full admin template while preserving all 32 upstream screens. The first endpoint is **GET-only and DEV-only** on loopback, with no external service control. **Exit (first vertical slice accepted):** on-device 18/18 tests, Vite build, lint and HTTP/API negative-method/origin checks PASS. The user confirms the panel looks good. Further read-only diagnostics, root Gate 1 and automated browser acceptance remain follow-up work.

## P2 — local GUI

Launch a desktop-first dashboard manually by CLI, ideally using the **entire** pinned ShadcnStore Vite React admin template (all routes/screens retained initially), then adapting features in later sprints, retaining browser-native pinch zoom on Android. Display inventory, detected settings, ownership and service health. UI binds loopback, no login exposed over WAN. **Exit:** user can inspect existing server and nothing can stop it.

## P3 — PocketHost-owned server

Introduce a new owned test site, separate port and explicit lifecycle management with tests for collisions, start/stop and rollback. **Exit:** own server operable without touching any existing production application.

## P4 — package catalog and assisted configuration

Add reviewed install plans, explicit approvals and safe diagnostics; installation is never implicit during discovery.

## P5 — AI deploy, domains and Android package

Add scoped publish API, site validation, version rollback, optional public ingress and packaging only after threat model, contract and device tests.

## Blockers

Before P1, obtain actual read-only Local Agent session capability and a verified host baseline. Do not infer host state from GitHub sources.
