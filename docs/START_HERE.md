---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Smallest safe entrypoint
---

# PocketHost — minimal context

Read [AGENTS](../AGENTS.md), fresh `main` and one scoped AGENTS.md.

**Active:** one-pass **code → deploy → verify**, without tests unless the owner explicitly requests them. Samsung Termux Agent is the normal PocketHost executor. The latest independently verified PocketHost panel revision before the next update is `f402ef6adca57fa20e399628e7470dd8830fd0a9` (Services menu); **always recheck live ownership and installed SHA**. Git source may be ahead of the live panel.

**Remote execution:** [Termux task/result contract](LOCAL_AGENT_TERMUX.md), private `MichalMatu/local-agent` branch `agent-control`, exact Samsung installation only. Reject stale task receipts, duplicate IDs, incorrect shell targets, and ambiguous results. Owner-authorized tests are part of the pinned fast-flow task, never a scheduled job.

**Next product:** disposable owned Node.js + GitHub Hosting, then domains/SSH/web analytics/backup. Preserve independent H2 static Hosting and all external services; Pro/unified APK deferred.

[Fast flow](DEV_ITERATION.md) · [Termux Agent](LOCAL_AGENT_TERMUX.md) · [Roadmap](ROADMAP.md) · [Quality](QUALITY_GATES.md).
