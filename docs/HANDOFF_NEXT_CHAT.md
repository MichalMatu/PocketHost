---
status: active
owner: core
last_reviewed: 2026-11-19
purpose: One-page A8 resume handoff; checkpoint holds detailed evidence
---

# PocketHost — A8 handoff

Start with [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md),
[the current A8 checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md)
and [Local Agent transport](LOCAL_AGENT_TERMUX.md).

## Verified device state

- Last A8 live code: `90b42f23a211bef180dac1f04667e75710b5b6db`, guarded task
  `pockethost-a8-quality-doc-planner-90b42f2-20261119-v1`: **PASS**.
- Owned panel PID **14715**, start ticks **45606162**, HTTP **200**; protected services
  unchanged. This proves release safety, **not** hosted-app HTTP readiness.
- Private A8 queue at handoff: **319 tasks, 319 terminal results, zero pending**.
- Last executed scoped QA **PASS** only for `b1fde537dd9dc1b3ef8b40e2e2eb17b7e70328b6`
  (logs, UI, admin types, module boundaries, budgets). Later `81f269ad`,
  `8d257a03`, `a7f85e33` and `90b42f2` have regression tests written, **not run**.
- This docs-only handoff commit is not running code. Independently recheck
  current `main`, A8 live SHA, owner PID/start ticks and agent queue before new work.

## Quality follow-up

- Reconcile the changed-file plan; request one **fresh explicit owner approval**
  listing final 40-character target SHA and exact check categories before running
  A8 `verify-changed.mjs --execute`. Deployment consent is not QA consent.
- Make changes only for demonstrated defects. Bound browser API responses,
  keep `apps/admin/src` separate from Termux host operations, and preserve
  independent Static and Node ownership/release boundaries.
- Delete files only after verifying no imports, active routes, scripts,
  tests or historical references. Framework/CMS examples are still routed,
  so they are **not** confirmed orphan files.

## Hard boundaries

Only the paired A8 Termux Local Agent runs builds, guarded deploys or approved
QA. Never use Mac/S22, Codex, Work, Actions or schedulers. No automatic retry.
Reboot, SSH/WAN/Cloudflare, foreign services, untrusted Node and off-device
Restic require separate consent. Services S1–S4 remain `READY_FOR_ACCEPTANCE`.
Hosting P0 browser sign-off, full G2/G3 and off-device recovery remain open.

See [MVP plan](MVP_EXECUTION_PLAN.md), [quality](QUALITY_GATES.md)
and [the current checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md).
