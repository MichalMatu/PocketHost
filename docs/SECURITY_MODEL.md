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

## Optional trusted-LAN convenience gateway — P3 candidate

The one-off developer gateway is isolated in `src/modules/host/lan-gateway.mjs`. It does not change the loopback-only listeners of the real admin dev process or owned static site. If separately enabled, it listens only on an explicit exact private IPv4 address and forwards to two fixed loopback ports: an owner-approved, login-free admin endpoint and a GET/HEAD-only demo site. It rejects foreign Host/Origin, cross-site requests, unsupported methods on the demo and non-LAN source addresses. No admin credentials are required on the explicitly trusted LAN. Any device on the subnet can operate the isolated PocketHost demo.

This is a local convenience feature, **not production authentication**: it uses HTTP rather than TLS and must never be opened through a public tunnel, router port forwarding or an untrusted WLAN. It is manually started and must not be registered for boot autostart in DEV. Its security tests and real-device acceptance are tracked in the [LAN checkpoint](checkpoints/2026-11-06-local-network-access.md).
