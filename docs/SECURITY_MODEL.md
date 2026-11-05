---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Record security invariants and deferred threats
---

# Security Model

## Assets

Phone integrity, existing IleStoi.pl and Local Agent processes, filesystem, Termux package state, stored sites, credentials, public-domain routing, authenticated administration.

## Initial controls

- Loopback-only administration; no public exposure of the UI or control API.
- Read-only discovery with strict command allowlists, timeouts, bounded output and redaction.
- No subprocess invocation based on untrusted text or user-controlled shell fragments.
- External or unknown services are never manageable by runtime controls.
- No directory traversal, symlink escapes, overwrites outside PocketHost-owned directories or port hijacking.
- No credential values in logs, reports, Git or UI diagnostics.
- Deny destructive or privileged operations by default; introduce explicit scoped approvals in later ADRs.

## Deferred threats

Public tunnels, DNS/API credentials, publishing ZIP archives, dependencies fetched by AI, multi-tenant isolation, package installs, commercial hosting uptime, automatic updates and APK distribution are **not implemented** and require dedicated review.

## Incident rule

If a test risks IleStoi.pl or Local Agent, stop PocketHost testing and capture sanitized diagnostic evidence; do not attempt an automatic repair or restart of external services.
