---
status: accepted
owner: core
last_reviewed: 2026-11-08
purpose: Owner-directed full power-user Android/Shizuku evolution
---

# ADR-0013: Full-capability Shizuku integration as a PocketHost core module

## Decision

PocketHost is an **Android/Termux power-user application**. Shizuku is a
core integration, not a temporary diagnostic workaround. The owner explicitly
rejects arbitrary feature caps, permanently read-only modules and
self-imposed command/operation restrictions that prevent legitimate
power-user tasks. The user should be able to request the complete
spectrum of operations supported by the device's actual Android
ADB or root privileges.

The project must deliver working features instead of disabled buttons
or endless QA gates. The iterative DEV loop applies unchanged.

## Real privilege model

Shizuku Manager is already installed on Samsung SM-S906B (Android 16).
A prior Mac ADB read-only probe obtained a real
`dumpsys cpuinfo` snapshot (31% TOTAL); this proves an **ADB**
measurement, **not** PocketHost/Shizuku connection.
Checking `pidof moe.shizuku.privileged.api` alone is not a reliable
Shizuku Binder availability test. Native Binder handshake and
authorization state are still unverified.

The PocketHost browser/Termux Node process does not magically gain
Shizuku privileges. Integrate a separately owned **native Android
PocketHost Companion**, request access from Shizuku for that app,
observe its server mode (ADB/root) and expose actual operation
results through a typed local IPC bridge.

No assumption that ADB means root, no forced rooted device, no fake
permissions, and no pretending an action succeeded if Android rejected it.

## Product scope — no artificial ceilings

Capability negotiation is dynamic rather than a permanently fixed
allowlist. The power-user roadmap includes CPU and process usage,
packages and app management, permissions, system settings, services,
background tasks, storage, backup, device diagnostics and
user-initiated advanced shell commands. Expose capabilities when
available; show real Android permission errors when unavailable.

The owner may intentionally manage apps and services outside PocketHost.
The UI must communicate selected targets and consequences. A button
must not silently perform unrelated actions. This is user intent,
not an arbitrary rule banning advanced controls.

## Connectivity and safety

The existing web panel on trusted LAN is currently **login-free**.
Do not attach unrestricted privileged execution to that HTTP listener
until the native bridge has a verified authorization boundary tied
to the real owner. A locally authorized companion can expose privileged
operations on demand. Do not broadcast privileged endpoints or
credentials over the current LAN or execute hidden actions on other
services. The correct answer is to implement the real privileged
transport, not to prohibit features forever.

## Execution order

1. Shizuku menu/route, typed session contract and architecture source.
2. Native companion with Shizuku Binder permission prompt; reflect
   service-running / authorization / ADB-vs-root state in the panel.
3. Real CPU/process telemetry, with native Android/ADB evidence.
4. Expand to the broader available Android controls and advanced shell,
   adding useful UI one capability at a time with fast DEV feedback.
5. Only after native bridge exists, replace the initial static
   status with live authenticated capability discovery.

**Current implementation is phase 1**, not a working Shizuku Binder
connection.
