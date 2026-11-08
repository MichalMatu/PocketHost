---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Record security invariants and deferred threats
---

# Security Model

## Assets

Phone integrity, existing IleStoi.pl and Local Agent processes, filesystem, Termux package state, stored sites, credentials, public-domain routing, authenticated administration.

## Owner-directed power-user Shizuku mode (2026-11-08)

The owner wants broad Shizuku-backed device control, without
artificial product policy blocks. The historical initial read-only
defaults are for the existing modules, **not** a permanent ban on
future advanced actions. For owner-initiated advanced operations,
offer available Android capabilities (including package, service,
permission and process administration) according to actual Shizuku
ADB/root mode and any OS restrictions. Never falsely claim root,
authorization or a successful action.

The browser is currently accessible from trusted LAN without login.
Do **not** expose a blanket privileged shell or Android Binder bridge
through that unauthenticated network endpoint. Design a local-only
privilege channel with genuine Shizuku per-app consent and
user-directed target/action confirmation for impactful commands.
These are real privilege and user-intent boundaries rather than
arbitrary feature limitations. Do not start unrequested destructive
operations, disable Android protections or affect other services
merely because the module exists.

## Initial controls

- Loopback-only administration; no public exposure of the UI or control API.
- Read-only discovery with strict command allowlists, timeouts, bounded output and redaction.
- No subprocess invocation based on untrusted text or user-controlled shell fragments.
- External or unknown services are never manageable by runtime controls.
- No directory traversal, symlink escapes, overwrites outside PocketHost-owned directories or port hijacking.
- No credential values in logs, reports, Git or UI diagnostics.
- Deny destructive or privileged operations by default; introduce explicit scoped approvals in later ADRs.

## Deferred threats

Public tunnels, DNS/API credentials, arbitrary backend execution from archives, dependencies fetched by AI, authenticated multi-tenancy, package installs, commercial hosting uptime, automatic updates and APK distribution are **not implemented** and require dedicated review.

## H2 bounded static ZIP and folder ingestion — accepted device scope

H2 adds only static site bundles through the explicit PocketHost-owned
site API. The server accepts at most 6 MiB ZIP archives or bounded
browser-selected folder assets, validates central directory paths,
rejects traversal/symlinks and corrupt CRC, restricts allowed extensions,
enforces 100 files, 8 MiB total uncompressed content and 2 MiB per asset,
and requires a root `index.html`.

Eight sites occupy separate `127.0.0.1` ports. Processes are managed
only when their exact owner ID, instance, port, cwd, command line,
PID and start ticks are verified. The existing manual private-LAN
gateway only proxies GET/HEAD previews after that ownership check;
administrative writes require the existing exact local Origin,
verified subnet and a deliberate intent header.

**This is not user authentication.** Any device admitted to the
trusted home subnet may still reach the login-free HTTP admin panel.
It must not be WAN-forwarded, reverse-proxied publicly or connected
to an untrusted network. An authenticated control plane is a later
milestone, not a capability implicitly provided by the H2 marker.

See [H2 physical checkpoint](checkpoints/2026-11-07-h2-static-hosting-source.md).

## Incident rule

If a test risks IleStoi.pl or Local Agent, stop PocketHost testing and capture sanitized diagnostic evidence; do not attempt an automatic repair or restart of external services.

## Optional trusted-LAN convenience gateway — P3 candidate

The one-off developer gateway is isolated in `src/modules/host/lan-gateway.mjs`. It does not change the loopback-only listeners of the real admin dev process or owned static site. If separately enabled, it listens only on an explicit exact private IPv4 address and forwards to two fixed loopback ports: an owner-approved, login-free admin endpoint and a GET/HEAD-only demo site. It rejects foreign Host/Origin, cross-site requests, unsupported methods on the demo and non-LAN source addresses. No admin credentials are required on the explicitly trusted LAN. Any device on the subnet can operate the isolated PocketHost demo.

This is a local convenience feature, **not production authentication**: it uses HTTP rather than TLS and must never be opened through a public tunnel, router port forwarding or an untrusted WLAN. It is manually started and must not be registered for boot autostart in DEV. Its security tests and real-device acceptance are tracked in the [LAN checkpoint](checkpoints/2026-11-06-local-network-access.md).

## H3 trusted-LAN administrative controls — branch candidate

The owner explicitly requested immediate administrative operations
without making a login system a prerequisite. H3 provides typed,
confirmed package, workspace, runit and backup actions on a separately
tested branch. This does not create user authentication: anyone
admitted to the owner's trusted LAN can operate the panel, so it
must remain private and must never be published through a tunnel.

Native command invocation uses fixed Termux executables and typed
arguments, not user-supplied shell strings. Existing foreign services
remain excluded from lifecycle control. Local Restic repository
encryption uses an automatically generated owner-private key file,
never included in API responses or diagnostic output. Losing both
the device and its local key means encrypted backups cannot be
recovered. Independent recovery-key storage remains essential.

## H3.4 privileged local controls — owner-approved, unshipped

The new full File Manager and ttyd terminal deliberately provide
Termux-user privileges. A LAN-connected device can therefore access
files and launch shell commands without a password. This is **not**
safe on untrusted Wi-Fi and must never be exposed publicly.

Files use exactly chosen home/prefix/shared roots, reject symlink
traversal and require explicit targets. ttyd starts manually with
one client and a fixed loopback listener, not as a boot service.
Restic full backups exclude the local repository and encryption key,
and restore only to staging. Independent key recovery and off-device
backup media are not yet accepted. No live service was modified
by creating this source candidate.

The trusted-LAN gateway strips the `X-PocketHost-Agent-Intent`
header before forwarding requests to Vite. Only a same-user
loopback client such as an authorized Local Agent host task can
send that non-browser intent without an Origin.
