---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-14
purpose: Minimal component boundaries
---

# Architecture

Admin UI (`apps/admin`) → typed `src/shared` contracts → `src/modules/host` for all Termux filesystem/process/OS operations. Companion/Shizuku is an optional native Android-loopback bridge; browser has no Binder privilege.

Module, managed service and user-created Hosting project identities are separate. Discovery does not grant ownership. H2 static and Node.js Hosting have independent ports, processes, files and releases; reuse infrastructure interfaces only.

## Host coordinator contract

PocketHost is the host-level **desired-state coordinator** for every service it
creates or explicitly enrolls. It owns the registry, installation and updates,
autostart policy, health/readiness observations, bounded restart/recovery
policy, logs, and rollback evidence. Official Termux `runit` performs the
actual process supervision; PocketHost must not create a competing scheduler
or infer ownership from a port, process name or discovery result.

SSH and Git are first-class host capabilities for managed access and project
deployments, not an alternative host execution engine. Existing SSH and Local
Agent infrastructure is **observed/protected by default**; control transfer
requires an explicit, independently attested ownership/enrollment record and
a recoverable access path. Local Agent remains a separate trusted task
transport even when the PocketHost panel is unavailable.

The A8 bootstrap established owned panel/watch services, global Termux runit
and a Termux:Boot supervisor hook. Boot-time autostart has not yet been
physically reboot-qualified. Subsequent M2-M5 work must use the common
registry/health/lifecycle contract across static and Node Hosting, without
merging their release and storage boundaries.
