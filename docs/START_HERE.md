---
status: active
owner: core
last_reviewed: 2026-11-25
purpose: Short current entrypoint for stable PocketHost MVP
---

# Start here

Read [agent rules](../AGENTS.md), [current handoff](HANDOFF_NEXT_CHAT.md), [quality evidence](QUALITY_GATES.md), and [architecture](ARCHITECTURE.md). The v1.0.0 source baseline stays frozen. Sprints 1–6 are closed. Sprint 7 — Application Starters is TODO for the next owner-directed iteration. See [roadmap](ROADMAP.md).

**Source baseline:** `main@d2bacd081ad0879d49a08e3c7fd97789185ad6e4` qualified G0–G2 on A8 (486/486 UI, 469 Node PASS, 1 SKIP; 76.11% line coverage). Subsequent documentation-only cleanup does not constitute a new application QA run.

**Last confirmed deployed A8 DEV:** `e11ee0995a939e7ffe71c695eeeb02addd0f9fe4` (Sprint 6 guarded deploy and readback; see [quality gates](QUALITY_GATES.md)). Re-read device ownership, live source SHA, PID/ticks, protected-service state and HTTP **before** any later deploy; never infer the current live version from this document. The owner reported browser acceptance of the current MVP.

**Recovery:** scoped encrypted local Node Restic backup → isolated restore and hash comparison was performed. This does not prove off-device disaster recovery. See [MVP evidence](MVP_INTEGRATION_CHECKLIST.md).

For future source changes follow [Local Agent transport](LOCAL_AGENT_TERMUX.md) and [guarded iteration](DEV_ITERATION.md). For earlier development logs see the [history index](checkpoints/README.md).
