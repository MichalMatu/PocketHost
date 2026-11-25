---
status: active
owner: product
last_reviewed: 2026-11-25
purpose: Ordered post-v1 sprint backlog and completion evidence
---

# PocketHost — post-v1 roadmap

**ACTIVE — UX-01–UX-07, owner reprioritization 2026-11-25.** S1–S7 and CF1 are closed. UX work precedes S8–S12 and CF2–CF5.

One sprint at a time. Preserve the v1.0.0 tag, historical evidence and approval gates. Mark a sprint complete only with exact-source QA and required guarded deployment receipts. Never replay an unknown task.

## Current priority

See [UX execution plan](UX_EXECUTION_PLAN.md) for the full scope, baseline and acceptance checklist.

- [ ] UX-01 — Static Hosting workspaces (ACTIVE).
- [ ] UX-02 — Node.js Hosting workspaces.
- [ ] UX-03 — Shared UI foundations.
- [ ] UX-04 — Information architecture and noise reduction.
- [ ] UX-05 — CSS and template cleanup.
- [ ] UX-06 — Module boundaries and enforceable quality.
- [ ] UX-07 — Visual and regression closeout.

## Completed

- [x] v1.0.0 — G0–G2 at `d2bacd0`; standalone installer source QA at `b8d67ba`.
- [x] S1 — Static Hosting lifecycle.
- [x] S2 — Simplify and remove unused code.
- [x] S3 — Performance measurement.
- [x] S4 — Architecture and test quality.
- [x] S5 — Traffic Analytics.
- [x] S6 — SQLite Studio.
- [x] S7 — Application Starters.
- [x] CF1 — Quick Tunnel publishing and scoped UX acceptance.

Complete S1–S7 implementation and receipt details remain in the [previous roadmap at the immutable source revision](https://github.com/MichalMatu/PocketHost/blob/12850e758a7f695c745ca6d1e0014ba6ee3ee1e7/docs/ROADMAP.md). See [quality evidence](QUALITY_GATES.md) and [handoff](HANDOFF_NEXT_CHAT.md) for current acceptance. Clean-device installer/updater qualification remains deferred.

## Deferred after UX-07

Retain the original dependencies and scope in [the feature backlog](DEFERRED_FEATURE_SPRINTS.md).

- [ ] S8 — HTTP performance and traffic latency.
- [ ] S9 — File Manager Pro and project dependencies.
- [ ] S10 — Monitoring and optional notifications.
- [ ] S11 — GitHub Auto Deploy (gated).
- [ ] S12 — Python/PHP Hosting (gated).
- [ ] CF2–CF5 — [Cloudflare publishing](CLOUDFLARE_ROADMAP.md), with independent approval gates.

## Deferred / separate owner scope

TeleDrive (Telegram file transport), email routing, off-device disaster recovery, physical Android reboot G3, standalone updater/clean-device acceptance, extended endurance, public ingress, untrusted-code isolation and the security sprint remain optional separate decisions. Do not treat upstream cron/watchdog, process manager, backup commands or whole Express backend as adoption candidates. Preserve the trusted-LAN MVP, protected services, independent Local Agent and MIT notices for any copied source.

## Cross-sprint acceptance

One sprint at a time; preserve completed S1–S7 and CF1 and their existing evidence. Before each new runtime batch, inspect fresh main, actual A8 live SHA, pending tasks, nearest rules and both relevant source implementations. Separate exact-SHA scoped QA from guarded DEV deployment; document terminal receipts, baseline/limits and explicit NOT RUN/HOLD/deferred states. Reuse existing tests and avoid repeating passed scopes without relevant changes. Documentation-only updates do not run A8 tasks. See [upstream source audit](UPSTREAM_REUSE_STRATEGY.md) for rationale, and [handoff](HANDOFF_NEXT_CHAT.md) for resume.
