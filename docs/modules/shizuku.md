---
status: source-candidate
owner: shizuku
last_reviewed: 2026-11-08
purpose: Native Shizuku-backed Android power-user integration
---

# Shizuku Module

This module is the foundation for broad Android power-user operations
inside PocketHost. It is not a security-restricted demo or read-only
end-state. The user chooses what to manage. Actual Android ADB/root
capabilities and Shizuku's own authorization define the limits.

## Interfaces

- `src/shared/shizuku.ts`: initial typed session/privilege/capability
  model; new capabilities are negotiated dynamically.
- `/shizuku`: owner-facing UI hub, installed-app evidence,
  native connection state and planned capability surfaces.
- Future `PocketHost Companion`: Android app linking Shizuku SDK via
  Binder, explicitly requesting Shizuku authorization from the user.
- Future IPC: local type-safe bridge between companion and Termux,
  with explicit operation target and result reporting.

## Status and first device evidence

Samsung SM-S906B, Android 16; Shizuku app installed.
Mac ADB `dumpsys cpuinfo` returned a genuine 31% TOTAL sample.
No native PocketHost companion exists yet and Shizuku per-app
authorization is **not verified**. The current hub does not
claim service connection or execute privileged operations.

## Incremental delivery

Implement real Shizuku connection state first; then true CPU/
process telemetry and more extensive Android apps/packages,
permissions, services, settings, backup, storage and advanced
shell control. Avoid artificial feature bans, pretend grants
and heavy tests for tiny UI changes. Preserve the existing DEV
panel and the user's explicit intent for mutations.

[ADR-0013](../adr/0013-shizuku-power-user.md)
