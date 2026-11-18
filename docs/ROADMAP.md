---
status: active
owner: core
last_reviewed: 2026-11-18
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

Execution: only verified A8 Local Agent; no scheduler, no GitHub Actions/Codex/Work, no default tests, no automatic retries. [Rules](../AGENTS.md).
