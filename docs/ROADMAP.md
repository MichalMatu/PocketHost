---
status: active
owner: product
last_reviewed: 2026-11-24
purpose: Ordered post-v1 sprint backlog and completion evidence
---

# PocketHost — post-v1 roadmap

The owner resumed development on 24 November. Preserve the accepted v1.0.0 source tag, Git history and independent A8 deployment evidence. This file is the single current sprint checklist; update it at each milestone. Mark an item [x] only when its stated acceptance evidence exists. Record exact source SHA, QA receipt and (for runtime changes) independent guarded deployment receipt. Unknown or failed checks stay open/HOLD; never replay unknown tasks. Do not repeat completed tests without a relevant change. Work on one sprint at a time.

## Maintenance already delivered

- [x] v1.0.0 source qualification: G0–G2 at d2bacd0 (see [quality gates](QUALITY_GATES.md)).
- [x] Opt-in standalone Termux installer source and manifest/structure/docs QA at b8d67ba; see [installation](INSTALLATION.md). Actual clean-device installation and generic update path remain unqualified.

## Sprint 1 — v1.0.1: Static Hosting lifecycle (ACTIVE)

- [x] Source diagnosis: whole-site deletion missing in UI, API and SiteFleetHost; eight-site limit cannot be reclaimed.
- [x] Implement explicit owned-site removal, including last site and empty catalog; safe stopped/verified process state, scoped filesystem validation, freed allocation, no foreign service impact; deliberate UI confirmation and inventory readback.
- [ ] Test empty and populated site removal, running/unknown refusal or verified stop, foreign paths, symlinks, concurrent/stale writes, failure outcomes, last-site empty state and capacity/port reuse; test isolated fixtures only.
- [x] Exact-SHA A8 QA, separate guarded DEV deployment/readback, document evidence. No actual customer-site deletion without separate owner action.

Runtime source `120adca4fcb9ee4cc089b58994bc0a87ca35f583`: exact A8 QA `pockethost-a8-static-removal-qa-120adca-20261124-v1` PASS (12/12 checks plus code budgets); separate deploy `pockethost-a8-static-removal-deploy-120adca-20261124-v1` PASS, HTTP 200 and protected services unchanged. Additional test-only coverage for eight-site capacity, concurrent mutations, uncertain PID and occupied port is committed; its own QA is pending. No real sites deleted. A8 preflight `pockethost-a8-static-lifecycle-preflight-20261124-v1` returned READ_ONLY_READY at live `349087d` with protected services attested.

## Sprint 2 — simplify and remove unused code

- [ ] Measure dead code/dependencies with existing Knip and import/route references before deleting anything.
- [ ] Evaluate legacy owned-demo route/API, placeholder module declarations, duplicated facades and theme preset catalog; remove only proven unused parts, preserve used workflows and compatibility.
- [ ] Targeted regression tests, dependency/structure checks and guarded A8 verification where applicable.

## Sprint 3 — A8 performance

- [ ] Record repeatable idle and bounded load baselines for CPU, RSS, I/O, latency, processes/descriptors and battery where measurable; do not invent battery readings.
- [ ] Assess one Node process per static site, synchronous file operations and Vite DEV serving overhead. Compare shared static server/runit designs before changing lifecycle.
- [ ] Apply only measured improvements; benchmark before/after and verify isolation and regressions. No new watchdog, scheduler or unrelated service changes.

## Sprint 4 — architecture and test quality

- [ ] Incrementally extract server API plugins from vite.config.ts; split termux-service-admin, node-runit-host and large UI pages by responsibility, preserving behavior.
- [ ] Consolidate duplicate validation/contracts; improve actual browser/server import boundary checks and file budgets.
- [ ] Add missing real API lifecycle, race/failure/recovery and bounded endurance tests; use isolated fixtures and existing QA/Test Lab, not another framework.
- [ ] Reconcile stale module/docs statuses with exact receipts. Evaluate standalone updater and clean-device acceptance; physical install/reboot and real data operations require separate scope.

## Sprint 5 — v1.1: Traffic Analytics

- [ ] Review [TermuxPanel](https://github.com/himalayladha/termux-hosting-panel) analytics implementation and license before reuse.
- [ ] Per-site request counts, status breakdown, bytes, top routes and bounded time-series/RPS. Reuse telemetry and release identities; measure overhead, bound storage, no additional supervisor.
- [ ] Exact-SHA tests and guarded A8 deployment/readback.

## Sprint 6 — SQLite Studio

- [ ] Review upstream database UX; implement read-only scoped discovery, schema/tables and paginated rows for owned projects.
- [ ] No arbitrary SQL console, host scan, DB mutation or live replacement. Test bounds, ownership, malformed data and read errors.
- [ ] Exact-SHA QA and guarded deployment/readback.

## Sprint 7 — Application Starters

- [ ] Compare existing HTML/Node import and starter flows with upstream; add only useful missing templates.
- [ ] Verify generated projects in isolated fixtures; exact-SHA QA and guarded deployment/readback.

## Deferred / separate owner scope

Python/PHP runtimes, off-device disaster recovery, physical Android reboot G3, public ingress, untrusted-code isolation and security sprint remain separately scoped. Preserve the trusted-LAN MVP, protected services and independent Local Agent. Do not merge upstream Express backend, cron, watchdog, backup engine or tunnel automation wholesale; comply with MIT notice requirements for copied code.

Start each session with [current handoff](HANDOFF_NEXT_CHAT.md), [architecture](ARCHITECTURE.md), [quality evidence](QUALITY_GATES.md), [Local Agent transport](LOCAL_AGENT_TERMUX.md) and this checklist.
