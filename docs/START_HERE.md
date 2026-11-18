---
status: active
owner: core
last_reviewed: 2026-11-18
purpose: Minimal agent entry and current-state navigation
---

# PocketHost — start here

1. Read [root agent rules](../AGENTS.md) and the [MVP tracker](MVP_EXECUTION_PLAN.md); use fresh `main` and nearest scoped `AGENTS.md`.
2. Read the **[current A8 checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md)** for last verified live SHA, exact QA receipts, proven capabilities and open acceptance. Never treat docs-only HEAD as deployed.
3. Use [Local Agent transport](LOCAL_AGENT_TERMUX.md) for A8 operations; [FAST FLOW rules](DEV_ITERATION.md) for deployment versus separately approved QA.

**Current state:** private-LAN Static + trusted Node Hosting functional MVP, S1–S4 fixed-worker implementation awaiting owner acceptance; scoped P1 safety QA PASS. No full repository G2/G3 or reboot certification. Restic off-device stays in the indefinite backlog.

**Current priority:** targeted reliability fixes only if reproducible; complete deferred Hosting browser and Services acceptance when separately requested. No scheduler, public WAN exposure, untrusted Node execution, unapproved test run, backup or reboot. See [roadmap](ROADMAP.md) and [architecture](ARCHITECTURE.md).
