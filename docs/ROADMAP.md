---
status: active
owner: core
last_reviewed: 2026-11-20
purpose: High-level delivery sequence, not a duplicate release history
---

# PocketHost roadmap

For evidence and stage-by-stage status use the [current checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md) and [MVP tracker](MVP_EXECUTION_PLAN.md).

1. **A8 private-LAN Basic DEV:** running, with inventory/monitoring and independently supervised Local Agent.
2. **Hosting Static + trusted Node:** device-tested core lifecycle and visual MVP accepted; functional current-browser acceptance deferred.
3. **Services S1–S4:** fixed-template worker implemented and physically exercised; owner acceptance, general-purpose worker qualification and reboot evidence open.
4. **P1 reliability/security:** targeted fail-closed catalogs, owner-safe routes, log redaction; latest scoped UI/TypeScript/boundaries/budgets QA PASS. Fix reproducible defects, not accepted layouts.
5. **Platform:** LAN/Boot durability and safe Git/SSH configuration still partial; requires physical owner authorization where appropriate.
6. **Post-MVP:** genuine untrusted-process isolation, HTTPS/auth/WAN, domain/Cloudflare integration, optional Companion/Shizuku, other runtimes.
7. **Restic off-device:** indefinitely deferred [design-only backlog](P1_OFF_DEVICE_RESTIC_PLAN.md). No transfer or restore without separate owner approval.

## Product direction after Basic MVP

**Goal:** Evolve PocketHost from one Android/Termux host panel into a reliable,
low-maintenance console for multiple owner-controlled Android phones/tablets.
Treat this as a direction, not an implemented feature or authorization to operate
additional devices.

1. **Finish the current device:** verify the raw Local Agent console against
   original Termux output (including the native emitter), close current-browser
   Static/Node create/deploy/update/logs/rollback acceptance, and resolve
   reproducible UX defects without repeating accepted redesigns.
2. **Prove unattended reliability:** qualify boot/autostart, runit service
   ownership, health/recovery and clear failure states through separately
   approved physical tests. No competing scheduler.
3. **Simplify everyday deployment:** make GitHub repository association,
   revision visibility and guarded deploy/update/rollback a cohesive project
   flow; reuse existing Hosting contracts, not a parallel deployment engine.
4. **Expand to multiple devices:** design a unified inventory/dashboard with
   per-device online/offline and freshness indicators, independent Local Agent
   status, hosting workloads and links into each device's own panel. Keep
   per-device identity, ownership and execution boundaries explicit.
5. **Optional later additions:** owner-selected application templates,
   actionable fault alerts and additional supported runtimes only after
   multi-device basics work reliably.

**Order and scope:** This section is a future-facing product sequence;
existing P0/P1 acceptance and deployment rules remain authoritative.
No automatic implementation, remote enrollment, package installation,
reboot, security sprint or infrastructure changes follow from this roadmap.
Security work remains separately deferred per [owner rules](../AGENTS.md).

Execution: only verified A8 Local Agent; no scheduler, no GitHub Actions/Codex/Work, no default tests, no automatic retries. [Rules](../AGENTS.md).
