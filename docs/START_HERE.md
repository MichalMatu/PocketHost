---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Smallest safe entrypoint
---

# PocketHost — minimal context

Read [AGENTS](../AGENTS.md), fresh `main` and one scoped AGENTS.md.

**Active:** one-pass **code → deploy → verify**, without tests unless the owner explicitly requests them. Samsung Termux Agent is the normal PocketHost executor. The latest independently verified PocketHost panel revision before the next update is `7ba09e8c1010de867816fe5b891b552e6f774db7` (FAST FLOW accepted); **always recheck live ownership and installed SHA**. Git source may be ahead of the live panel.

**Remote execution:** [Termux task/result contract](LOCAL_AGENT_TERMUX.md), private `MichalMatu/local-agent` branch `agent-control`, exact Samsung installation only. Reject stale task receipts, duplicate IDs, incorrect shell targets, and ambiguous results. Owner-authorized tests are part of the pinned fast-flow task, never a scheduled job.

**Current owner goal:** **zero passwords, zero backup encryption**. Two plaintext SQLite backups (one IleStoi, one PhotoMap) are verified in Android Downloads; five temporary duplicate snapshots and the unused Restic password were removed. Full plain `home + usr` TAR task `termux-rebuild-plain-full-archive-20261114-v1` is submitted but its terminal receipt must be checked. Copy off-phone and prove restore before clean-bootstrap with dedicated PocketHost controls. See [Termux rebuild plan](TERMUX_REBUILD_RECOVERY.md). No erase or service stop authorized yet. Preserve independent H2 static Hosting and all external services; Pro/unified APK deferred.

[Fast flow](DEV_ITERATION.md) · [Termux Agent](LOCAL_AGENT_TERMUX.md) · [Roadmap](ROADMAP.md) · [Quality](QUALITY_GATES.md).
