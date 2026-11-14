---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-14
purpose: Minimal component boundaries
---

# Architecture

Admin UI (`apps/admin`) → typed `src/shared` contracts → `src/modules/host` for all Termux filesystem/process/OS operations. Companion/Shizuku is an optional native Android-loopback bridge; browser has no Binder privilege.

Module, managed service and user-created Hosting project identities are separate. Discovery does not grant ownership. H2 static and Node.js Hosting have independent ports, processes, files and releases; reuse infrastructure interfaces only.
