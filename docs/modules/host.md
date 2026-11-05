---
status: accepted
owner: host
last_reviewed: 2026-11-05
purpose: Define the exclusive Termux host adapter contract
---

# Host Module

## Responsibility

The only module that may interact with operating system processes, Termux tools and host filesystem APIs. It exposes narrow, typed capabilities to feature modules through application ports.

## Initial permissions

Read-only, allowlisted inventory probes with per-call timeout, bounded output and redaction. Explicitly represent unavailable tools and permission errors. No fallback to unrestricted shell.

## Forbidden

No arbitrary command strings, modification of existing service configuration, package installs, process kills or scanning user files without explicit future approval.

## Quality

Test allowlist rejection, timeout and error paths. No shell execution can occur in UI or other modules.
