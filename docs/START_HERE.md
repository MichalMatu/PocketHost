---
status: active
owner: core
last_reviewed: 2026-11-17
purpose: Minimal safe A8 handoff
---

# PocketHost — start here

Read [AGENTS](../AGENTS.md), [MVP tracker](MVP_EXECUTION_PLAN.md), current `main` SHA and nearest scoped `AGENTS.md`.

## Device and execution

Only verified Galaxy A8 / official Termux Local Agent, private `MichalMatu/local-agent:agent-control`. Do not touch Mac/S22, Work, Codex, Actions, scheduler, SSH/WAN or unowned services. PocketHost DEV and Local Agent have independent runit supervision.

Last verified live A8 panel: `79be0852cb204b535bfc0ce8a42a78aaf92330ea`, PID 22154, HTTP 200, protected services unchanged; receipt `pockethost-a8-hosting-metrics-format-fast-flow-20261117-v1`. Later docs-only commits are not deployed. Recheck live SHA and ownership before action.

## Product and scope

PocketHost offers general-purpose static and Node.js Hosting and Termux services, without hardcoded customer applications. Static Create → Publish → Start → private LAN render → manual HTTP check was owner-accepted 2026-11-17. Static update/rollback and generic Node execution remain unaccepted. Services S1–S4 fixed-worker implementation is frozen pending acceptance; reboot/Termux:Boot and backups unqualified.

Current focus: Node.js Hosting on A8 with authenticated owner authorization; **never bypass passwordless LAN Node write denials**. User Node code has the Termux UID and is not sandboxed; run only owner-reviewed trusted source. Stronger isolation is still open.

## Quality and deployment

One task per release: code → guarded FAST FLOW → exact-SHA, PID/start ticks, protected-service and HTTP readback. Code-only commit is not deployment. Unknown result means HOLD; no retries. Docs-only updates never restart panel.

Tests, lint, format, types, smoke and quality checks need fresh explicit approval per scope and revision, separately from deployment. Reboot, WAN, SSH and foreign services need separate permission. See [handoff](HANDOFF_NEXT_CHAT.md), [quality gates](QUALITY_GATES.md), [Local Agent](LOCAL_AGENT_TERMUX.md), [architecture](ARCHITECTURE.md), [roadmap](ROADMAP.md) and [A8 checkpoint](checkpoints/2026-11-17-a8-static-mvp-local-agent-handoff.md).
