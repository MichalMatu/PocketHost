---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-14
purpose: Only approved panel self-recovery
---

# ADR-0014 PocketHost runit

Existing Termux runit supervises the **owned PocketHost panel only** and its bounded watchdog at loopback 127.0.0.1:8787. Verify identity and rollback before refresh; never restart foreign services or expose WAN.
