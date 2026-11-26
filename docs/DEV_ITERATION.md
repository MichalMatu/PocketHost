---
status: active
owner: core
last_reviewed: 2026-11-26
purpose: Minimal guarded A8 code, QA and deployment discipline
---

# Guarded iteration

The owner granted standing approval for necessary **non-destructive** PocketHost tests, lint, formatting, typechecks, builds and guarded DEV deployments. This does not authorize customer-data operations, unrelated services, Local Agent upgrades, physical reboot, public/WAN changes, off-device transfers or destructive restore.

The private `MichalMatu/local-agent:agent-control` transport is described in [Local Agent Termux](LOCAL_AGENT_TERMUX.md). All project code execution and source/UI QA run **only on the paired Samsung A8**, except the documented narrow, read-only Mac `scripts/test-lab` browser/GET scope. No Codex, Work, GitHub Actions or scheduled tasks.

## When runtime code changes again

1. Fetch fresh `main`, ensure a clean isolated A8 QA checkout, confirm the actual deployed SHA, panel ownership, PID/start ticks, LAN HTTP, protected-service state and rollback eligibility. Never trust a historic live SHA.
2. Run relevant **separate** SHA-pinned A8 QA using `scripts/dev/verify-changed.mjs` and a verified ancestor, `--execute`, exact 40-hex `--approved-head` and selected `--approved-checks`. Available categories: `format,structure,boundaries,docs,markdown,root-lint,admin-lint,root-types,admin-types,node,ui,syntax`. Retain terminal receipts; use the smallest useful scope.
3. For an accepted code candidate, publish **one** guarded A8 deploy task using `ops/termux/fast-flow.mjs --base=<verified-live-sha> --target=<exact-target-sha> --apply`. This command does **not** execute tests. Require terminal exact-SHA live owner/PID/ticks/HTTP and protected-service readback.
4. If a task is absent, UNKNOWN, interrupted or guard-failed, mark **HOLD**; never automatically replay or skip an unverified result. Do not overlap tasks on the same A8 resource.

For the reviewed global `apps/admin/src/index.css` modification, pass `--reviewed-index-css` to the exact-SHA QA runner. The flag requires format, admin-types and UI checks, preserves all unrelated manual-review gates and reports `visualAcceptance: PENDING_BEFORE_AFTER`. Capture a matching read-only baseline before guarded deployment; run a separate A8 build and compare matching after screenshots before closing the UX change. The flag does not authorize stylesheet deletions or certify geometry.

**Docs-only work:** commit to Git only; no A8 tests, builds, refresh or deployment. Passing G2 on one source SHA does not automatically certify newly changed runtime code or a new live installation.
