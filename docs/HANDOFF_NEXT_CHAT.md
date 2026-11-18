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

- Last A8 live code: `44d2c79cb119bb287e0742e7c593fa94c00ea063`, guarded task
  `pockethost-a8-quality-format-cleanup-44d2c79-20261119-v1`: **PASS**.
- Owned panel PID **12508**, start ticks **45687615**, HTTP **200**; protected services
  unchanged. This proves release safety, **not** hosted-app HTTP readiness.
- Private A8 queue at handoff: **322 tasks, 322 terminal results, zero pending**.
- One-shot QA at `ccb13c71c047a1995d9543c63511f0cb5e432d28` **FAIL** only
  for the MVP tracker table alignment after a docs-only text change.
  Syntax, structure, docs, root lint and Markdown lint **PASS**; admin types,
  Node and UI tests **SKIPPED** by the gate. The earlier `5f1ee2a` QA had
  three formatting failures corrected at deployed code `44d2c79`.
- This docs-only correction restores the MVP tracker row verbatim from the
  previously formatted `44d2c79` source. **No QA has run on this newer SHA.**
  The last earlier scoped fully PASS QA remains limited to `b1fde537`.
- This docs-only handoff commit is not running code. Independently recheck
  current `main`, A8 live SHA, owner PID/start ticks and agent queue before new work.

## Quality follow-up

- Formatting corrections from the first one-shot QA require a **new** owner
  approval naming the new full SHA and exact categories before any A8
  `verify-changed.mjs --execute`. Prior consent was single-use and pinned to
  `5f1ee2acbef29094c5f518bf28ef332996d1e391`.
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
