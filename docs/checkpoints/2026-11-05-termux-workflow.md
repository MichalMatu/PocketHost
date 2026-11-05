---
status: in-progress
owner: core
last_reviewed: 2026-11-05
purpose: Track implementation of Termux-only Local Agent development workflow
---

# Checkpoint — Termux Local Agent workflow (2026-11-05)

## Decision

The owner selected the Termux phone with existing Local Agent as the sole PocketHost execution/validation/compile target. GitHub Connector may publish source, documentation and correctly addressed private agent tasks. PocketHost has no DEV autostart.

## Project-binding clarification

The independent Termux Local Agent host-command executor does not require PocketHost project enrollment/binding to run ordinary Git or developer commands. The phone's verified host/installation identity still matters for transport routing. The owner reports tools are installed, but no current live versions are asserted by source-only inspection.

## Documentation change

Added the explicit [fast-start runbook](../LOCAL_AGENT_TERMUX.md), normative root/module instructions, links and [ADR-0003](../adr/0003-termux-local-agent-execution.md). Corrected the older sandbox-oriented Gate workflow.

## Verification status

**Docs-only source changes.** The Termux Local Agent has **not** been called in this checkpoint; no physical task result, installed toolchain version, checkout state, compile success or Gate 0/Gate 1 PASS is claimed. Earlier 12/12 sandbox tests remain historical and cannot satisfy the new Termux-only execution rule.

## Next authorized step

Verify the exact current phone host/installation, publish harmless read-only preflight, inspect independent PocketHost checkout, then run the real on-device Gate 0 and resolve missing lockfile/dependencies after reviewing their scope. Never change IleStoi.pl or the Agent service to unblock a gate.
