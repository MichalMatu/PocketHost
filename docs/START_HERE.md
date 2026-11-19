---
status: active
owner: core
last_reviewed: 2026-11-19
purpose: Minimal agent entry and current-state navigation
---

# PocketHost — start here

1. Read [root agent rules](../AGENTS.md) and the [MVP tracker](MVP_EXECUTION_PLAN.md); use fresh `main` and nearest scoped `AGENTS.md`.
2. Read the **[current handoff](HANDOFF_NEXT_CHAT.md)** for latest verified A8 live SHA and exact QA/deployment receipts. The [18 November checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md) is historical evidence, not the live source. Never treat docs-only HEAD as deployed.
3. Use [Local Agent transport](LOCAL_AGENT_TERMUX.md) for A8 operations; [FAST FLOW rules](DEV_ITERATION.md) for deployment versus separately approved QA, and [Test Lab](TEST_LAB.md) for one-shot Mac read-only browser/API diagnostics.

**Current state:** private-LAN Static + trusted Node Hosting functional MVP, S1–S4 fixed-worker implementation awaiting owner acceptance; scoped P1 safety QA PASS. No full repository G2/G3 or reboot certification. Restic off-device stays in the indefinite backlog.

**Current priority:** close the DEV browser feedback loop with read-only Mac Test Lab and bounded A8 code/deploy/readback; then complete deferred Hosting browser and Services acceptance when separately requested. No scheduler, public WAN exposure, untrusted Node execution, unapproved test run, backup or reboot. See [roadmap](ROADMAP.md) and [architecture](ARCHITECTURE.md).
