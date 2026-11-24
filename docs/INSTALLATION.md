---
status: active
owner: core
last_reviewed: 2026-11-23
purpose: Clean installation of PocketHost from a new official Termux instance
---

# Clean Termux installation

Use the one-line command in the [root README](../README.md) on a **fresh official Termux** Android installation. It installs required Termux and npm dependencies, creates `~/Projects/PocketHost-Standalone`, then uses the same guarded ownership markers and two runit service contracts as the existing A8 prototype. The A8-specific `cold-bootstrap-a8.mjs` and its live checkout are **not** invoked.

## Installation constraints

- Require official app-private `HOME` and `PREFIX`, non-root UID and Node.js 22 or newer.
- Refuse an existing standalone checkout, PocketHost service registration, live owner/gateway markers or leftover stage directories _before_ installing packages.
- Clone `main` by default, or opt in to a published `POCKETHOST_REF=vX.Y.Z` tag. Never use an unverified remote URL. Keep the original Git origin.
- Use both committed npm lockfiles (root and admin), with lifecycle scripts disabled. npm is the only supported package manager for the panel.
- Use the standard Termux `termux-services` daemon. If it is absent and there are other enabled/unknown service directories, stop rather than risk starting them. Do not restart a running daemon.
- Create only `pockethost-panel` and `pockethost-panel-watch`; check the loopback HTTP endpoint and owned PID/source markers. A failed bootstrap remains in a guarded incomplete state that needs manual inspection, **not** an automatic destructive rollback.
- No public network changes, SSH/tunnel reconfiguration, Local Agent installation, customer-data import, reboot or Termux:Boot setup.

## After installation

Local panel: `http://127.0.0.1:8787/`. To access it from other devices, explicitly enable the **private** LAN interface in the panel's network settings. Keep the no-login admin interface off the public Internet.

This installer is **not an updater**. To upgrade an installed panel, first verify the currently live SHA and use a separately designed guarded update path. The older A8 `fast-flow.mjs` is device/checkout-specific and is not a generic standalone updater.

On a new Android device, a real fresh-install acceptance test (dependencies, runit adoption, UI and LAN behavior) must be completed separately. Source/unit QA on the existing A8 does not equal that physical acceptance.
