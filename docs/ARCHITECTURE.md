---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Describe high level architecture and trust boundaries
---

# System Architecture

## Layered model

```text
Local browser (loopback or private LAN gateway)
           |
        UI module
           |
 typed application ports / services
           |
 inventory | runtime | packages | sites | config | diagnostics | ai (later)
           |
      Host adapter boundary
           |
 Termux tools, process information and owned app data
```

Termux remains an independently maintained application; PocketHost is an additional project launched from CLI. A native Android shell can later reuse the control plane.

## Isolation rules

- UI never directly executes commands.
- Feature modules use ports/interfaces and cannot import another module's internal implementation.
- The Termux host adapter is the only layer permitted to invoke subprocesses or inspect `/proc`.
- Host adapter starts with **read-only allowlisted discovery**, no arbitrary shell API.
- Runtime management targets only processes tagged as PocketHost-owned; never infer ownership from a port number or process name.
- Site metadata and configuration remain separated from actual website content and secrets.
- API integrations are separate, opt-in modules with authentication and scoped capabilities; no AI API in the first milestone.

## Trust boundaries

Untrusted sources include network requests, file paths, discovered service metadata, remote AI providers and installed packages. Treat inspection output as untrusted text. No hard-coded host paths, secrets or public ingress. See [security model](SECURITY_MODEL.md).

## Architectural evolution

Inventory and UI first. Add owned runtime and storage second. Add package management and AI deploy behind explicit capability grants after security review. Native APK packaging is a later transport decision, not a reason to fork Termux now.

## Owner-approved private LAN exception — 2026-11-06

The actual administration backend remains bound to `127.0.0.1:8787` and the owned demonstration to `127.0.0.1:18787`. A separately owned, manually launched gateway binds only an exact private phone IPv4 address and exposes `18878` (admin) and `18879` (GET/HEAD-only site). At the owner's explicit request, **no login is required** on the trusted home Wi-Fi: any connected host can operate the PocketHost demo. This is not safe for public WAN administration. Host/Origin/Fetch Metadata checks, process ownership and P3 intent enforcement remain mandatory; no autostart or router forwarding. See [ADR-0006](adr/0006-private-lan-access.md).

## Generic managed runtime contract — source candidate

`src/shared/managed-runtime.ts` defines application-neutral instance identity, state and host ports. The pure policy `src/modules/runtime/managed-runtime.ts` enforces owner, release, port and lifecycle transitions without importing PhotoMap. PhotoMap supplies a thin policy binding through `src/modules/runtime/photomap-runtime.ts` and retains its explicitly disabled host adapter.

Future applications must register distinct approved identities and adapters; do not copy PhotoMap's fixed ID, port, paths, Python commands or data models into the shared engine. A general multi-project registry, runtime activation and API write controls are **not implemented or authorized**. PRoot does not provide OS-user isolation.
