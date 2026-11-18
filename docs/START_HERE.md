---
status: active
owner: core
last_reviewed: 2026-11-18
purpose: Minimal safe A8 handoff
---

# PocketHost — start here

Read [AGENTS](../AGENTS.md), [MVP tracker](MVP_EXECUTION_PLAN.md), current `main` SHA and nearest scoped `AGENTS.md`.

## Device and execution

Only verified Galaxy A8 / official Termux Local Agent, private `MichalMatu/local-agent:agent-control`. Do not touch Mac/S22, Work, Codex, Actions, scheduler, SSH/WAN or unowned services. PocketHost DEV and Local Agent have independent runit supervision.

Last verified A8 DEV source: `7ac250807d9dc301b4c306e879de2744be250a31` (2026-11-18 guarded FAST FLOW PASS, PID 7834/start ticks 44244411, HTTP 200, protected services unchanged; `pockethost-a8-deployments-compact-7ac2508-20261118-v1`). `/deployments` histories closed by default, redundant rollback notices removed; no API or permission changes. **QA NOT RUN** on this SHA. `/projects` MVP visual acceptance complete; its old failed UI QA fixtures were corrected in source but not re-tested. Browser sign-off `/deployments` remains open. Next `/runtime-logs`. No Node lifecycle mutation, backup/restore, reboot or scheduler.

## Product and scope

PocketHost offers general-purpose static and Node.js Hosting and Termux services, without hardcoded customer applications. Static Create → Publish → Start → LAN render and Static v2 → HTTP → rollback passed. Authenticated, trusted owned Node Create → Stage → Deploy → readiness/logs → Update → Stop/Start → rollback passed at the pinned A8 source. Scoped encrypted Node Restic backup → isolated staging restore passed (10 matching files). Browser sign-off, off-device backups, untrusted-source isolation and reboot/Termux:Boot remain unaccepted; Services S1–S4 fixed-worker implementation remains frozen pending acceptance.

Current focus: finish safe, explicitly gated Node backup UI and visual Hosting acceptance, then plan off-device protection. **Never bypass Node owner-token checks or the disabled backup-mutation DEV flag.** Node code runs with the Termux UID; only owner-reviewed trusted source is permitted until genuine process isolation exists.

## Quality and deployment

One task per release: code → guarded FAST FLOW → exact-SHA, PID/start ticks, protected-service and HTTP readback. Code-only commit is not deployment. Unknown result means HOLD; no retries. Docs-only updates never restart panel.

Tests, lint, format, types, smoke and quality checks need fresh explicit approval per scope and revision, separately from deployment. Reboot, WAN, SSH and foreign services need separate permission. See [handoff](HANDOFF_NEXT_CHAT.md), [quality gates](QUALITY_GATES.md), [Local Agent](LOCAL_AGENT_TERMUX.md), [architecture](ARCHITECTURE.md), [roadmap](ROADMAP.md) and [A8 checkpoint](checkpoints/2026-11-17-a8-static-mvp-local-agent-handoff.md).
