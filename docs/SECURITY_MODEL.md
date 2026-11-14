---
status: accepted
owner: core
last_reviewed: 2026-11-14
purpose: Non-negotiable device boundaries
---

# Security model

Unauthenticated DEV HTTP is private-LAN only, not WAN-safe. Native Companion is Android-loopback only; ADB is not root. All process/config mutations require verified target ownership, real privileges, path/symlink checks, explicit intent and rollback. No foreign services, credential disclosure or fake availability.
