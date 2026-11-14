---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Smallest safe entrypoint
---

# PocketHost — minimal context

Read [AGENTS](../AGENTS.md), fresh `main` SHA and one nearest scoped AGENTS.md.

**Current device:** Galaxy A8 Termux is the **only selected PocketHost target**. S22 PocketHost services have been removed; S22 continues unrelated IleStoi services. Do not route further PocketHost commands to S22.

**Immediate goal:** [cold install on A8](HANDOFF_NEXT_CHAT.md), **then** resume product work. The previously implemented FAST FLOW assumes a running, owned panel and hard-coded historical QA checkout; it is **not** the initial A8 installer. A8's paired Local Agent completed a read-only task; Node/npm were absent at the last check.

**Default product flow after A8 install:** [single-pass code → deploy → verify](DEV_ITERATION.md), read actual live SHA and ownership; **no tests by default** until the owner explicitly requests them. Read terminal private agent results, never infer completion from a queue commit. No GitHub Actions, Codex, Work, background scheduler or S22 migration.

[Closed S22 checkpoint](checkpoints/2026-11-14-s22-retired-a8-bootstrap-handoff.md) · [Local Agent transport](LOCAL_AGENT_TERMUX.md) · [Roadmap](ROADMAP.md).
