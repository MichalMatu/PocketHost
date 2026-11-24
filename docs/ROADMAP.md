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

## Sprint 1 — v1.0.1: Static Hosting lifecycle (CLOSED)

- [x] Source diagnosis: whole-site deletion missing in UI, API and SiteFleetHost; eight-site limit cannot be reclaimed.
- [x] Implement explicit owned-site removal, including last site and empty catalog; safe stopped/verified process state, scoped filesystem validation, freed allocation, no foreign service impact; deliberate UI confirmation and inventory readback.
- [x] Test empty and populated site removal, running/unknown refusal or verified stop, foreign paths, symlinks, concurrent/stale writes, failure outcomes, last-site empty state and capacity/port reuse; test isolated fixtures only.
- [x] Exact-SHA A8 QA, separate guarded DEV deployment/readback, document evidence. No actual customer-site deletion without separate owner action.

Runtime source `120adca4fcb9ee4cc089b58994bc0a87ca35f583`: exact A8 QA `pockethost-a8-static-removal-qa-120adca-20261124-v1` PASS (12/12 checks plus code budgets); separate deploy `pockethost-a8-static-removal-deploy-120adca-20261124-v1` PASS, HTTP 200 and protected services unchanged. Additional test-only coverage for eight-site capacity, concurrent mutations, uncertain PID and occupied port: exact A8 QA `pockethost-a8-static-edge-qa-bf671cf-20261124-v1` PASS (4/4 checks) at `bf671cf9f1893cf9e2c8606c21e55b1c46f1351c`. No redeployment needed for test/docs-only changes. No real sites deleted. A8 preflight `pockethost-a8-static-lifecycle-preflight-20261124-v1` returned READ_ONLY_READY at live `349087d` with protected services attested.

## Sprint 2 — simplify and remove unused code (ACTIVE)

- [x] Measure dead code/dependencies with import/route references and existing analysis tooling (verify availability first) before deleting anything.
- [ ] Evaluate legacy owned-demo route/API, placeholder module declarations, duplicated facades and theme preset catalog; remove only proven unused parts, preserve used workflows and compatibility.
- [ ] Targeted regression tests, dependency/structure checks and guarded A8 verification where applicable.

A8 read-only reference audit `pockethost-a8-sprint2-reference-audit-24979fd-20261124-v2` PASS at `24979fd`: 473 tracked source files, four documentation-only module directories, nine direct npm dependencies with no literal references, 18 possible unused UI files. The scan is a candidate list, not a complete import graph. Knip is available as a pinned npm exec script, not an installed root dependency; no download was performed.

- [x] Batch A: remove four unreferenced upstream UI components (drawer, hover-card, navigation-menu, card-decorator; 21,273 source bytes). Exact A8 QA `pockethost-a8-sprint2-ui-prune-qa-932a067-20261124-v1` PASS (5/5 and budgets); deploy `pockethost-a8-sprint2-ui-prune-deploy-932a067-20261124-v1` PASS at `932a067f6e4481263b065f24d66f33ce6f36e9c2`, HTTP 200, protected services unchanged.
- [x] Batch B1: remove eleven additional unreferenced UI files (24,009 source bytes): unused Node LAN view, brand icons and nine unused primitives. Active Node owner-access workflow stays in projects/page.tsx. At `7fe7ace0b43cfb6c77938e63be88245ef6969ab0`, `pockethost-a8-sprint2-b1-qa-7fe7ace-20261124-v1` inner QA PASS (5/5 and budgets), original npm build wrapper exit 127; separate direct Vite build `pockethost-a8-sprint2-b1-build-7fe7ace-20261124-v1` PASS; guarded deploy `pockethost-a8-sprint2-b1-deploy-7fe7ace-20261124-v1` PASS, HTTP 200 and protected services unchanged. Total 15 files / 45,282 source bytes removed.
- [ ] Batch B2: validate remaining hook/font candidates and dependency graph, including CSS and build-time references; prune only confirmed unused dependencies with consistent lockfile. Keep the Vite declaration file. Review nine candidate direct dependencies and preserve `date-fns` pending peer/optional dependency verification. Prepare lockfile offline in an isolated scratch directory; no live dependency install or package upgrades.
- [ ] Batch C: evaluate four documentation-only module directories and their structure/test contracts; preserve active Host/Shizuku/diagnostics functionality.
- [ ] Batch D: resolve legacy demo route/API and duplicated facades without touching any existing owned demo instance. Keep both referenced theme catalogs unless an explicit product decision changes them.

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
