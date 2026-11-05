---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Record upstream Termux preservation decision
---

# ADR-0002: Preserve upstream Termux in early phases

## Context

A production service already runs on the official Termux environment. A fork would complicate package compatibility and app updates.

## Decision

Implement a standalone Termux-side control plane and local GUI, initially invoked manually by CLI. Avoid a second Linux distribution and any Termux source modification. Consider a branded APK only after the host controller is stable and licensing/update strategy is reviewed.

## Consequences

Simpler updates and lower risk, but no single APK in the initial DEV milestone. Future Android launch and distribution need separate ADRs.
