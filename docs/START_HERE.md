---
status: active
owner: core
last_reviewed: 2026-11-27
purpose: Short current entrypoint for stable PocketHost MVP
---

# Start here

Read [agent rules](../AGENTS.md), [current handoff](HANDOFF_NEXT_CHAT.md), [quality evidence](QUALITY_GATES.md), and [architecture](ARCHITECTURE.md). The v1.0.0 source baseline stays frozen. Sprints 1–7 are closed. CF1 scoped implementation, QA and DEV deployment are closed; the owner confirmed public HTTPS reachability. UX-01–UX-07 are the current owner-authorized priority; S8–S12 and CF2–CF5 follow UX-07. See [roadmap](ROADMAP.md).

**Source baseline:** `main@d2bacd081ad0879d49a08e3c7fd97789185ad6e4` qualified G0–G2 on A8 (486/486 UI, 469 Node PASS, 1 SKIP; 76.11% line coverage). Subsequent documentation-only cleanup does not constitute a new application QA run.

**Current UX-05 state:** see [current handoff](HANDOFF_NEXT_CHAT.md) for the last confirmed live SHA, source candidate, completed gates and blocker. Re-read device ownership, live source SHA, PID/ticks, protected-service state and HTTP **before** any later deploy; never infer the current live version from this document. The owner reported browser acceptance of the earlier MVP.

**Recovery:** scoped encrypted local Node Restic backup → isolated restore and hash comparison was performed. This does not prove off-device disaster recovery. See [MVP evidence](MVP_INTEGRATION_CHECKLIST.md).

For future source changes follow [Local Agent transport](LOCAL_AGENT_TERMUX.md) and [guarded iteration](DEV_ITERATION.md). For earlier development logs see the [history index](checkpoints/README.md).
