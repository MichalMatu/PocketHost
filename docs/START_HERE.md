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

Last verified A8 DEV panel source: `634de0d36781662e4a59be7cf788df8eccadd2a1` (2026-11-18 guarded FAST FLOW PASS, PID 26503, HTTP 200, protected services unchanged; receipt `pockethost-a8-owned-first-disclosures-634de0d3-20261118-v1`). The project list is now first; owner access is compact and project creation/backup are collapsed. `/projects` runtime still precedes source editors; `/deployments` keeps compact histories. Exact-source one-shot QA `pockethost-a8-owned-first-disclosures-qa-634de0d3-20261118-v1` PASS (admin TypeScript, UI, boundaries, budgets, fake Restic). New browser UI still needs visual approval.

## Product and scope

PocketHost offers general-purpose static and Node.js Hosting and Termux services, without hardcoded customer applications. Static Create → Publish → Start → LAN render and Static v2 → HTTP → rollback passed. Authenticated, trusted owned Node Create → Stage → Deploy → readiness/logs → Update → Stop/Start → rollback passed at the pinned A8 source. Scoped encrypted Node Restic backup → isolated staging restore passed (10 matching files). Browser sign-off, off-device backups, untrusted-source isolation and reboot/Termux:Boot remain unaccepted; Services S1–S4 fixed-worker implementation remains frozen pending acceptance.

Current focus: finish safe, explicitly gated Node backup UI and visual Hosting acceptance, then plan off-device protection. **Never bypass Node owner-token checks or the disabled backup-mutation DEV flag.** Node code runs with the Termux UID; only owner-reviewed trusted source is permitted until genuine process isolation exists.

## Quality and deployment

One task per release: code → guarded FAST FLOW → exact-SHA, PID/start ticks, protected-service and HTTP readback. Code-only commit is not deployment. Unknown result means HOLD; no retries. Docs-only updates never restart panel.

Tests, lint, format, types, smoke and quality checks need fresh explicit approval per scope and revision, separately from deployment. Reboot, WAN, SSH and foreign services need separate permission. See [handoff](HANDOFF_NEXT_CHAT.md), [quality gates](QUALITY_GATES.md), [Local Agent](LOCAL_AGENT_TERMUX.md), [architecture](ARCHITECTURE.md), [roadmap](ROADMAP.md) and [A8 checkpoint](checkpoints/2026-11-17-a8-static-mvp-local-agent-handoff.md).
