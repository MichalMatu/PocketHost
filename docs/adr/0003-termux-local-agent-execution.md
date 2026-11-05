---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Record selection of Termux Local Agent as the exclusive PocketHost executor
---

# ADR-0003: Termux Local Agent only for development execution

## Context

PocketHost is designed to operate on the same Termux phone as IleStoi.pl and an already installed Local Agent. Testing solely on desktop or a Linux sandbox can miss Android/Termux paths, permission, package and process behavior. The owner requires all PocketHost coding-command execution, compilation and validation on the phone.

## Decision

Use GitHub Connector for source/document changes and secure private task transport. Execute all PocketHost dependency installs, build/lint/typecheck/test/compile commands on the **exact selected Termux host via its installed Local Agent**. The currently documented Termux lane is host-command-only; use a separate confirmed PocketHost checkout and do not assume project-mode registration. Keep PocketHost manual-CLI-only with no autostart in DEV.

## Consequences

Termux availability and toolchain readiness are hard dependencies, not reasons for desktop/sandbox fallback. Gate 1 needs real on-device dependencies/lockfile and published task result. Protect existing IleStoi.pl and Local Agent. See [fast-start runbook](../LOCAL_AGENT_TERMUX.md).
