---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Describe high level architecture and trust boundaries
---

# System Architecture

## Layered model

```text
Local browser (loopback only)
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
