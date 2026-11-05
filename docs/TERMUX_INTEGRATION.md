---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Specify safe Termux preflight and manual launch
---

# Termux Integration

## Execution ownership

All PocketHost source execution, package resolution, checks, tests and builds must be dispatched to and evidenced by the exact Termux Local Agent installation. The GitHub Connector handles repository edits and the private Git task/result transport. The Termux pilot currently supports bounded **host command tasks**, not an assumed automatic project runner. A PocketHost project binding is not required; the existing authorized host-command lane uses Git, npm and other CLI tools directly under Termux's user permissions. Keep the PocketHost checkout independent from IleStoi.pl, existing services, the Local Agent installation and its transport. See [fast-start and recovery runbook](LOCAL_AGENT_TERMUX.md).

## Development environment

- Existing official Termux installation on the same Android phone as IleStoi.pl and Local Agent.
- Termux is **not** a separate Linux kernel. Do not require Ubuntu, PRoot, Docker, or a Termux fork for early milestones.
- Start development GUI with a CLI command when implementation exists. No application or device boot autostart.
- Dependencies managed as ordinary project packages first; new system-level packages require an explicit approval path.

## Read-only host preflight

A future inventory adapter may query allowlisted process and network metadata, OS/Termux versions and package presence. The adapter must tolerate unavailable tools, Android permissions and partial output. It must never scan unrestricted storage or print environment secrets. Do not assume a particular HTTP server, port, tunnel, package manager configuration or production path.

## Configuration source of truth

Existing services' configurations remain external and read-only. PocketHost configuration lives in its own application directory. A discovered service may be displayed with detected settings, but PocketHost must not silently write to that service's config.

## Launch requirements

When a CLI launcher is implemented: bind the administrative UI to `127.0.0.1`, detect port conflicts and fail safely; show explicit status and stop only its own process. Avoid selecting an active IleStoi.pl or Local Agent port.

## Read-only host overview prototype

The `feat/host-overview-v1` source adds a development-only Vite route `/host` and a single `GET /api/v1/host/snapshot` endpoint. It uses the host-module fixed runit allowlist without accepting dynamic command arguments, shows only sanitized states and runtime memory/uplink metadata, and deliberately has **no service-control API**. Requests stay on 127.0.0.1:8787 and reject browser cross-origin access. This is not a hardened remote administration surface and must not be exposed to WAN.

The demo's existing `/dashboard` and all 32 upstream routes are retained. Qualification requires on-device Gate 0, app lint/build, exact HTTP read checks, write-method denial, negative cross-origin test, and a new real-phone visual check before this feature is called accepted.

## Evidence required before claims of compatibility

Record device architecture, Termux version, Node version, actual detection results with secrets redacted, port conflict tests and resource impact without stopping any external service. Unverified findings stay labeled unverified.
