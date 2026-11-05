---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Record foundation architectural decision
---

# ADR-0001: Foundation before application code

## Context

The project starts in an empty GitHub repository. Production IleStoi.pl and Local Agent are already active in Termux; accidental impact is unacceptable.

## Decision

Establish structured docs, per-module `AGENTS.md` files, an enforceable manifest, local quality gates and a no-autostart/manual-CLI development policy before application features. Discovery starts read-only. Do not use GitHub Actions, Codex or Work.

## Consequences

Slightly more foundation work; architecture checks and controlled change process exist from the first feature. Real hardware compatibility remains unverified until tested.
