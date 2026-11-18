---
status: active
owner: core
last_reviewed: 2026-11-18
purpose: Compact handoff; current checkpoint is the single source of factual state
---

# PocketHost — A8 handoff

**Start with the [2026-11-18 checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md).** It owns the last verified live SHA, PID/ticks, QA receipts, feature acceptance boundaries and backlog. Do not copy historical release chronology into this file.

## Autonomous P1 sprint in the next chat — owner direction (2026-11-18)

**Goal:** continue safe PocketHost P1 UI/API/security reliability work through the paired Galaxy A8 Termux Local Agent, with minimal owner involvement **during the active chat**. This is not a standing background job or scheduler. Read `main`, this handoff and the [current checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md); inspect actual code before choosing an issue.

**Latest verified A8 state (2026-11-18 23:00 UTC):** `main` code `8d257a0345931e37fa5dd8d2c01383b647491521` is deployed via terminal PASS task `pockethost-a8-p1-hosting-refresh-8d257a0-20261118-v1`. Panel PID **27009**, start ticks **45462791**, HTTP **200**, protected services unchanged; A8 tasks/results **315/315, no pending task** at closure. Earlier in this sprint `81f269ad0423aca5e68a1978f98bbde5b0be1a88` also deployed PASS. The last owner-approved **functional QA remains PASS only at `b1fde537dd9dc1b3ef8b40e2e2eb17b7e70328b6`**, task `pockethost-a8-p1-logs-nav-redaction-qa-b1fde53-20261118-v1`; no QA for either newer code SHA. Reconfirm live owner/source, queue and expected base before any further write; docs-only HEAD may move ahead of running code.

**Autonomous work loop:** identify the highest-value **reproducible** defect in existing read-only/admin UI, ownership-gated API, error states or state consistency. Prefer one small isolated patch and focused regression test **written but not executed by default**. Preserve shared UX/design and working Hosting flows; avoid speculative refactors. Commit to current `main`, create **one immutable A8 task** with exact verified live base and source target, perform guarded `fast-flow.mjs --apply` and verify terminal receipt: exact SHA, owner PID/start ticks, HTTP and protected services. Briefly report progress, then take the next safe independent issue **within the same active chat**, not requiring oversight after every micro-step. Never launch parallel tasks for the same repo.

**Stop conditions:** HOLD on missing/ambiguous task result, SHA drift, ownership mismatch, unsafe rollback preflight or protected-service change. No automatic retry/device change. QA, lint, format, types and smoke require **fresh explicit approval naming exact target SHA and scope**; autonomous sprint consent does not override this repo rule. Reboot, SSH/WAN/Cloudflare, foreign services, secrets, off-device Restic, browser backup activation and untrusted Node execution also require separate approval. No scheduling, Actions, Work or Codex.

**Deferred boundaries:** Hosting P0 final functional acceptance, Services S1–S4 owner sign-off, real Android boot qualification and off-device Restic remain OPEN/HOLD as in checkpoint. Do not silently mark ACCEPTED. On completing the sprint, update this compact handoff/checkpoint once (docs-only = no deploy); detailed task/result receipts belong in the private agent repo. On a genuine blocker, report exact evidence and safe next steps without repeated approval prompts.

## Completed in this P1 sprint

- `81f269a`: cancel superseded Termux:Boot read-only requests; prevent late responses from replacing a newer observation. Focused regression test committed, **not run**. A8 guarded deploy PASS, HTTP 200, protected unchanged.
- `8d257a0`: allow Hosting inventory Refresh while one API read is hung; existing abort/generation logic discards superseded responses. Focused regression test committed, **not run**. A8 guarded deploy PASS, HTTP 200, protected unchanged.
- The first read-only preflight task was rejected at task-schema validation **before executing**; corrected `pockethost-a8-p1-live-preflight-20261118-v2` returned PASS. No unknown/pending commands.
- No owner acceptance status was promoted. Services S1–S4 remain `READY_FOR_ACCEPTANCE`; Hosting P0 final browser sign-off and off-device Restic remain deferred.

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
