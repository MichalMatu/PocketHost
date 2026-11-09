---
status: accepted
owner: core
last_reviewed: 2026-11-09
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

## Target platform composition — approved 2026-11-09

The existing layered model above describes the initial source.
The accepted target adds three separately owned concepts:

```text
PocketHost UI
  |-- Modules: Node.js / Python / SSH / Cloudflare / Database later
  |-- Hosting: explicit ProjectRegistry with components[]
  |-- Managed services: ServiceRegistry with one verified owner each
  |
  +-- Shared typed contracts: dependencies, secrets references,
      source/build/release, health policy, backup and diagnostics
      |
      Host adapter -> existing Termux runit, tools and owned data
```

`ModuleRegistry` advertises runtime/infrastructure capabilities.
The Hosting orchestrator binds these capabilities to the projects
created inside PocketHost; it never discovers external Termux
processes as Hosting projects. The shared `SupervisorAdapter`
uses the installed runit rather than a new process manager.
Health-triggered recovery is a separate bounded policy and never
silently overrides a manual disable. `SecretRef` and scoped backup
contracts precede migrations of stateful services.

The early M3 vertical slice is a disposable Node project using
existing H2 static ownership, staging and release principles.
Full multi-component workflows and public routing follow after
that works. IleStoi and Local Agent remain external until their
own approved cutover; Local Agent is last. See [roadmap](ROADMAP.md)
and [target IA](TARGET_INFORMATION_ARCHITECTURE.md).

## Android-native power-user expansion (2026-11-08)

PocketHost's target is a full-power Android + Termux console.
A future **PocketHost Android companion** obtains its own permission
from the installed Shizuku app and uses Shizuku Binder APIs (ADB mode
or root mode, depending on the actual session), exposing negotiated
capabilities to the existing browser UI via a local typed bridge.
Shizuku does not turn Node.js in Termux into a privileged Android app
and does not automatically grant root. Privilege checks must be real,
not inferred from the app merely being installed.

```text
PocketHost UI /shizuku
    -> typed power-user actions and session state
    -> loopback/native companion bridge (future)
    -> Android companion + Shizuku permission
    -> Shizuku Binder / Android shell user service
    -> Android services, packages, processes, CPU, storage, controls
```

Avoid artificial product feature limits: owners may request advanced
package, service, permission, shell and device operations when the
actual runtime allows them. Keep user intent, target identity and
permission status explicit; do not silently mutate other services.
Historically read-only modules remain unchanged until individually
connected to this owner-directed power-user capability plane.
See [ADR-0013](adr/0013-shizuku-power-user.md).

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

The actual administration backend remains bound to `127.0.0.1:8787` and the owned demonstration to `127.0.0.1:18787`. A separately owned, manually launched gateway binds only an exact private phone IPv4 address and exposes `18878` (admin) and `18879` (GET/HEAD-only site). At the owner's explicit request, **no login is required** on the trusted home Wi-Fi: any connected host can operate the PocketHost demo. This is not safe for public WAN administration. Host/Origin/Fetch Metadata checks, process ownership and P3 intent enforcement remain mandatory; no standalone LAN gateway service autostart or router forwarding. The
later [ADR-0014](adr/0014-termux-panel-supervision.md) explicitly
permits the **PocketHost-owned DEV panel** to start through existing
Termux runit; its in-process LAN gateway follows that session and still
binds only the actual private Wi-Fi address.

## Generic managed runtime contract — source candidate

`src/shared/managed-runtime.ts` defines application-neutral instance identity, state and host ports. The pure policy `src/modules/runtime/managed-runtime.ts` enforces owner, release, port and lifecycle transitions without importing PhotoMap. PhotoMap supplies a thin policy binding through `src/modules/runtime/photomap-runtime.ts` and retains its explicitly disabled host adapter.

Future applications must register distinct approved identities and adapters; do not copy PhotoMap's fixed ID, port, paths, Python commands or data models into the shared engine. An explicit, application-neutral runtime registry is implemented and native-tested. This does **not** authorize runtime activation for PhotoMap, arbitrary multi-project deployment or API write controls. PRoot does not provide OS-user isolation.

## Runtime decoupling — source candidate, 2026-11-07

```text
Admin / typed API
  -> registered owned runtime contracts
  -> pure admission and lifecycle state machine
  -> host process supervisor, /proc ancestry and PRoot argv policy
  -> application adapter (PhotoMap TEST profile, or a different owned app)
  -> isolated workset / exact loopback instance
```

The shared core contains no PhotoMap path, interpreter, port or launch command.
Only a project-specific adapter can approve its immutable workset and process
identity. The PhotoMap adapter is still disabled for live execution. One process
group and a bounded observed child tree do not prove the absence of reparented
processes; physical acceptance and full rollback remain mandatory.

## Observability architecture — source candidate O1

A registered `observability` module will normalize
admitted read-only observations into bounded series.
`host` alone probes Termux and `/proc`; `runtime`
owns verified lifecycle identities; `diagnostics`
owns structured events; `packages` owns package
inventory; `apps/admin` renders typed views.
No cross-module internal imports or second
process supervisor are authorized.

Foreground bounded sampling, timestamps, honest
missing/permission-denied states and limited
history are required. Process observation is
not ownership or permission to signal.
The first on-demand source candidate exists, but remains **unverified on
Samsung for its final SHA**. There is no background daemon, ownership
inference or automated recovery.
See [ADR-0010](adr/0010-read-only-observability.md)
and [roadmap](ROADMAP.md).

## H2 static-site fleet — accepted device architecture

H2 does not adopt external processes or replace the
generic managed-runtime/PRoot registry. Its separate
PocketHost-owned `SiteFleetHost` adapter is the only
component allowed to create project directories,
assign loopback ports, write immutable static releases,
spawn or signal exact verified child PIDs, and read
bounded process logs/statistics.

The typed `/api/v1/sites` developer boundary accepts
strictly bounded ZIP or browser-selected folder static
assets. The `sites` module decodes and validates
content without filesystem access, while `host` owns
the actual confined storage and server processes.
The React `/sites` UI never executes host commands.

The existing manual trusted-LAN gateway retains its
two public-to-LAN ports: owner-approved admin port
18878 and GET/HEAD-only static previews on 18879.
An H2 preview on `/h2/<site-id>/` is admitted only
after checking the exact owner marker and the running
child's process identity and port. Each child listener
binds `127.0.0.1` only. No user-supplied program
is launched and no unrelated service is adopted.

Samsung full G2 and guarded LAN G3 passed at
application source `750c4b3`; owner Mac Chrome
file-picker acceptance remains a distinct step.
See [H2 checkpoint](checkpoints/2026-11-07-h2-static-hosting-source.md).

## H3.4 — full local administration, source candidate

The existing admin Vite process now composes pure typed requests
with fixed Termux host adapters: named filesystem roots, package
manager, runit, encrypted Restic scopes, and one manual ttyd
terminal proxied through the same loopback boundary. A Local Agent
host task can call the private HTTP action endpoint using a dedicated
agent-intent header; no Local Agent deployment or Git task transport
is modified. There is no password prerequisite, but the existing
private-LAN admission requirements and manual UI confirmations
still apply. See ADR-0011 for the associated trust warning.

## Termux-first UI navigation — 2026-11-08 source candidate

The dashboard treats monitoring, software, files, services, terminal,
backups and the Agent API as independent navigation routes. Hosting is
its own section. Legacy `/termux` redirects to `/system`, and the
original template examples remain reachable through a collapsed menu.
No new API, listener, process ownership or authorization is introduced.

One visible full-root File Manager handles HOME, PREFIX and shared
storage with a workspace shortcut. Hosted site releases have a separate,
read-only inventory; the legacy H3 workspace API remains for compatibility.
Backend consolidation requires a separately reviewed migration.
