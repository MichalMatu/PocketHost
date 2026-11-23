---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Executable next code slices for Chat Bridge plus paired A8 Local Agent
---

# PocketHost — next autonomous coding sprints

## Operating contract

- On **every** externally invoked Chat Bridge turn, load fresh `main`, [current handoff](HANDOFF_NEXT_CHAT.md), exact A8 result receipts and the nearest source `AGENTS.md`. If another conversation already completed a task, skip it.
- **Deliver code first**: choose one small independently reversible change to a real user flow, implement on `main`, add narrow regression coverage, record commit SHA and result. Continue to the next unfinished task on subsequent Bridge turns rather than ending permanently after one PASS. Keep a concise factual handoff.
- Routine nondestructive QA, tests, lint, typechecks, builds and guarded DEV deployments already have standing owner consent. Do not ask per SHA or category. Only verified A8 executes these; immutable tasks live in `MichalMatu/local-agent:agent-control`. Mac may only run the explicitly allowed, read-only `scripts/test-lab` screenshot/geometry/allowlisted-GET path with exact SHA and approved LAN scope; no builds, releases or external screenshot publication.
- **Nonblocking QA**: prefer format + exact dependency-mapped Node/UI cases, add TypeScript where imports/contracts changed; treat expensive full suites as separate qualification instead of a default for every small commit. Reuse caches. Set finite bounds; if a broad suite hangs or unrelated historical tests fail, preserve the terminal result, use at most one narrow diagnostic reproduction when allowed, fix quickly if possible, otherwise tag that feature `QA_OPEN` and proceed with a safe _independent_ code slice. Do not quietly certify a failing change, deploy a known broken module, requeue an unknown Agent task, or remove safety gates to gain speed.
- Never overlap conflicting tasks in the same A8 checkout. Before guarded DEV deployment verify live SHA, source ancestry, ownership, PID/start ticks, HTTP health and unchanged protected services; deployment and functional QA are separate receipts. Docs-only/test-lab-tool-only changes never require a gratuitous panel restart.
- No new cron/scheduler/GitHub Actions/Codex/Work. No edits to real hosted sites/customer DBs, public tunnel/DNS, protected services, Local Agent upgrade, device reboot, off-device transfer or destructive cleanup without separately scoped consent. Chat Bridge must supply the next turn: no promise of autonomous execution when the bridge stops.

## Prioritized small coding queue

**N1 — FAST FLOW QA speed, with no weakened safety.**
Review the real `changed-checks-policy.mjs`, `changed-checks.mjs`, `verify-changed.mjs` and tests after the mass deletion. Refine impact mapping for removed UI/fixtures and make a narrow targeted-UI path where appropriate; avoid a 300-second catch-all regression as a default. Add planner/runner contract tests and clear terminal reasons. Definition: one code improvement with targeted A8 Node/format evidence, no implicit broad QA, no bypass of SHA/category or ownership gates. Avoid optimizations that obscure failures.

**N2 — Static Hosting create/import UX.**
In `apps/admin/src/app/sites/`, extract another coherent create/import-related controller from the oversized legacy `page.tsx` (which must shrink, not grow), preserving ZIP/folder/custom HTML input validation and first-release behavior. Improve one concrete failure/loading/cancel/readback path and add its interaction regression. Do **not** create/delete an actual user site or claim real browser acceptance; simulated fixtures only until separate physical/browser approval.

**N3 — Node Projects UI separation and feedback.**
In `apps/admin/src/app/projects/`, extract a bounded read-only project selection, release-status or log-feedback controller from the ~66 KB legacy page. Preserve ownership token flow, safe error handling and the existing API. Add narrow UI tests for stale async responses and release selection. No actual Node rollout, DB migration or real app-data writes as a side effect of testing.

**N4 — Local Agent console experience.**
Improve the existing `/local-agent` screen and/or its bounded read-only log client: show the genuine source log lines in timestamp/order as demanded in `AGENTS.md`; ensure loading/reconnect/error behavior is explicit. Avoid inventing summaries of missing source lines, changing Local Agent installation or adding a second poller/watchdog. Add small UI contract tests on fixtures.

**N5 — Frontend screenshot/geometry feedback loop (if the prior four are done or blocked).**
Work with existing `scripts/test-lab/capture.mjs` and `preview.mjs` to improve allowlisted, reproducible read-only screenshots, viewport geometry reports and compact local inspection artifacts. Source-only tooling is allowed; real Mac captures require the verified narrow Test Lab scope. Do not upload any raw screenshot or private LAN data to public GitHub or transmit it to ChatGPT without separate scoped authorization.

## What to do on a blocker

1. If current feature has **QA_FAIL**: preserve SHA, failing named check and short explanation. Diagnose once if useful; fix that feature, or leave it not deployable and select the next independent scope. Do not rerun a whole suite in a loop.
2. If Agent task is **pending/unknown**: do not retry or queue conflicting device work. Continue safe source-only work in a separate module if it does not depend on that result. Never report PASS without its terminal receipt.
3. If `main` moved: re-read source and rebase the intended conceptual change on current `main`; do not overwrite another chat's work.
4. At the end of **each** Bridge turn, report only `CODE SHA | A8 DEPLOY PASS/HOLD/not-run | QA scope PASS/FAIL/not-run | next task`. Revisit the plan on the next Bridge invocation. The all-night objective depends on the existing Chat Bridge actually continuing to trigger new turns.
