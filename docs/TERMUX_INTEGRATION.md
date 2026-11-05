---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Specify safe Termux preflight and manual launch
---

# Termux Integration

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

## Evidence required before claims of compatibility

Record device architecture, Termux version, Node version, actual detection results with secrets redacted, port conflict tests and resource impact without stopping any external service. Unverified findings stay labeled unverified.
