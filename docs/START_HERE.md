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

Last verified live A8 DEV code: `bc61493f2cc00c43243234246016c6de1ee5494d` (2026-11-18 FAST FLOW PASS, panel PID 30036, HTTP 200, protected services unchanged, receipt `pockethost-a8-hosting-visual-cleanup-bc61493f-20261118-v1`). Based on user-supplied screenshots of five Hosting pages, `/projects` now prioritizes runtime above lengthy source editors, while `/deployments` uses shorter identifiers and collapsible histories. Screenshots predate this change; **new UI not yet visually accepted**. Scoped QA PASS at `48a9c9015dcd025896f9bcf92c1a9acc92a814de` does not certify `bc61493f2cc00c43243234246016c6de1ee5494d` (tests NOT RUN).

## Product and scope

PocketHost offers general-purpose static and Node.js Hosting and Termux services, without hardcoded customer applications. Static Create → Publish → Start → LAN render and Static v2 → HTTP → rollback passed. Authenticated, trusted owned Node Create → Stage → Deploy → readiness/logs → Update → Stop/Start → rollback passed at the pinned A8 source. Scoped encrypted Node Restic backup → isolated staging restore passed (10 matching files). Browser sign-off, off-device backups, untrusted-source isolation and reboot/Termux:Boot remain unaccepted; Services S1–S4 fixed-worker implementation remains frozen pending acceptance.

Current focus: finish safe, explicitly gated Node backup UI and visual Hosting acceptance, then plan off-device protection. **Never bypass Node owner-token checks or the disabled backup-mutation DEV flag.** Node code runs with the Termux UID; only owner-reviewed trusted source is permitted until genuine process isolation exists.

## Quality and deployment

One task per release: code → guarded FAST FLOW → exact-SHA, PID/start ticks, protected-service and HTTP readback. Code-only commit is not deployment. Unknown result means HOLD; no retries. Docs-only updates never restart panel.

Tests, lint, format, types, smoke and quality checks need fresh explicit approval per scope and revision, separately from deployment. Reboot, WAN, SSH and foreign services need separate permission. See [handoff](HANDOFF_NEXT_CHAT.md), [quality gates](QUALITY_GATES.md), [Local Agent](LOCAL_AGENT_TERMUX.md), [architecture](ARCHITECTURE.md), [roadmap](ROADMAP.md) and [A8 checkpoint](checkpoints/2026-11-17-a8-static-mvp-local-agent-handoff.md).
