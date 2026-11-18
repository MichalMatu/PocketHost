---
status: active
owner: core
last_reviewed: 2026-11-18
purpose: Compact handoff; current checkpoint is the single source of factual state
---

# PocketHost — A8 handoff

**Start with the [2026-11-18 checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md).** It owns the last verified live SHA, PID/ticks, QA receipts, feature acceptance boundaries and backlog. Do not copy historical release chronology into this file.

## Resume safely

- Source: `MichalMatu/PocketHost:main`; compare fresh HEAD with **independently verified** deployed Galaxy A8 code, which may be behind after docs-only commits.
- Executor: only paired Samsung A8 Termux Local Agent; private `MichalMatu/local-agent:agent-control`, immutable per-host tasks and task-results. See [runbook](LOCAL_AGENT_TERMUX.md).
- For code: one change → guarded `fast-flow.mjs --apply` task → exact-SHA owner/PID/start ticks/protected-service/HTTP readback. Never duplicate an in-flight task, never auto-retry a HOLD.
- For QA: only with a fresh owner decision naming exact SHA and checks; use the separate A8 `verify-changed.mjs` gate. Deployment safety verification is not a test.
- Docs-only commit never deploys, restarts panel or runs checks.

## Acceptance and safety boundaries

Hosting Static and trusted Node physical flows work on A8, and user accepted current **visual MVP**. Their latest current-browser functional sign-off is **deferred**, not ACCEPTED. Services S1–S4 fixed-template worker flow has scoped physical evidence but remains READY_FOR_ACCEPTANCE. Full G2/G3, real reboot/autostart and arbitrary untrusted code isolation are not certified. Off-device Restic explicitly belongs to undated backlog.

No scheduler, reboot, WAN, SSH, protected/foreign-service operation, second physical backup or unapproved QA. Node source shares Termux UID and the admin runs over unencrypted trusted LAN.

Details: [MVP tracker](MVP_EXECUTION_PLAN.md), [evidence](MVP_INTEGRATION_CHECKLIST.md), [quality](QUALITY_GATES.md), [architecture](ARCHITECTURE.md). Old detailed handoff remains retrievable with `git show 3513e452d2d98b3615ec2305247a2eaa5deabf8c:docs/HANDOFF_NEXT_CHAT.md`.
