---
status: accepted
owner: core
last_reviewed: 2026-11-06
purpose: Authorize narrowly scoped manual trusted-LAN access while retaining internal loopback boundaries
---

# ADR-0006 — Private LAN convenience access

## Decision

The owner explicitly authorized one-click access to PocketHost from a trusted home LAN. This extends the original loopback-only MVP inspection rule **only** for a separately tested, manually launched gateway. It does not authorize exposing arbitrary Termux services, the production IleStoi.pl backend, Local Agent, or PhotoMap.

The internal Vite admin and owned static demo continue to listen on `127.0.0.1:8787` and `127.0.0.1:18787`. The gateway accepts inbound HTTP **only on an exact, currently assigned RFC1918 IPv4 address**, never a wildcard, and uses separate dedicated ports. Administration is password-protected with a random locally stored owner-only credential; the static demo is GET/HEAD only. Host, Origin, Fetch Metadata, allowed HTTP methods, explicit P3 intent and process ownership remain enforced.

## Alternatives

An SSH local-port forward provides encryption without new listeners, but the owner prefers bookmarkable LAN links. Opening Vite directly on `0.0.0.0` was rejected because its DEV mutation API is not production authentication. Reconfiguring the productive IleStoi.pl tunnel and PhotoMap Pi service is unnecessary and excluded.

## Security and lifecycle conditions

- The LAN is assumed private and trusted. HTTP Basic is **not encrypted**; do not use this mode on guest Wi-Fi or forward it through the public internet.
- Never commit passwords, print them in public logs or include them in the private agent task request/receipt. The owner reads the generated password directly from the phone.
- Allow only source work on the PocketHost working branch; require actual Samsung Termux tests, negative request checks, process ownership, guarded rollback, manual Chrome acceptance and a checkpoint before treating LAN as accepted.
- The gateway is started explicitly and has **no autostart**. Do not modify the startup policy or other services.

## Current status

Architecture and the owner's authorization are accepted; implementation and live LAN browser acceptance are tracked separately in [the LAN checkpoint](../checkpoints/2026-11-06-local-network-access.md).
