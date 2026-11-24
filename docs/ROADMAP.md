---
status: active
owner: product
last_reviewed: 2026-11-24
purpose: Ordered post-v1 sprint backlog and completion evidence
---

# PocketHost — post-v1 roadmap

Living post-v1 checklist. Preserve the v1.0.0 tag, history and independent A8 evidence. Mark [x] only with exact-source QA and required guarded deployment receipts. Unknown/failed checks stay HOLD; never replay unknown tasks or repeat passed checks without relevant changes. One sprint at a time.

## Maintenance already delivered

- [x] v1.0.0 source qualification: G0–G2 at d2bacd0 (see [quality gates](QUALITY_GATES.md)).
- [x] Opt-in standalone Termux installer source and manifest/structure/docs QA at b8d67ba; see [installation](INSTALLATION.md). Actual clean-device installation and generic update path remain unqualified.

## Sprint 1 — v1.0.1: Static Hosting lifecycle (CLOSED)

- [x] Source diagnosis: whole-site deletion missing in UI, API and SiteFleetHost; eight-site limit cannot be reclaimed.
- [x] Implement explicit owned-site removal, including last site and empty catalog; safe stopped/verified process state, scoped filesystem validation, freed allocation, no foreign service impact; deliberate UI confirmation and inventory readback.
- [x] Test empty and populated site removal, running/unknown refusal or verified stop, foreign paths, symlinks, concurrent/stale writes, failure outcomes, last-site empty state and capacity/port reuse; test isolated fixtures only.
- [x] Exact-SHA A8 QA, separate guarded DEV deployment/readback, document evidence. No actual customer-site deletion without separate owner action.

Runtime source `120adca4fcb9ee4cc089b58994bc0a87ca35f583`: exact A8 QA `pockethost-a8-static-removal-qa-120adca-20261124-v1` PASS (12/12 checks plus code budgets); separate deploy `pockethost-a8-static-removal-deploy-120adca-20261124-v1` PASS, HTTP 200 and protected services unchanged. Additional test-only coverage for eight-site capacity, concurrent mutations, uncertain PID and occupied port: exact A8 QA `pockethost-a8-static-edge-qa-bf671cf-20261124-v1` PASS (4/4 checks) at `bf671cf9f1893cf9e2c8606c21e55b1c46f1351c`. No redeployment needed for test/docs-only changes. No real sites deleted. A8 preflight `pockethost-a8-static-lifecycle-preflight-20261124-v1` returned READ_ONLY_READY at live `349087d` with protected services attested.

## Sprint 2 — simplify and remove unused code (CLOSED)

- [x] Measure dead code/dependencies with import/route references and existing analysis tooling (verify availability first) before deleting anything.
- [x] Evaluate legacy owned-demo route/API, placeholder module declarations, duplicated facades and theme preset catalog; remove only proven unused parts, preserve used workflows and compatibility.
- [x] Targeted regression tests, dependency/structure checks and guarded A8 verification where applicable.

Reference audit `pockethost-a8-sprint2-reference-audit-24979fd-20261124-v2` PASS at `24979fd` (473 files). Literal reference scan is not a complete import graph; no Knip download.

- [x] Batch A: remove four unreferenced upstream UI components (drawer, hover-card, navigation-menu, card-decorator; 21,273 source bytes). Exact A8 QA `pockethost-a8-sprint2-ui-prune-qa-932a067-20261124-v1` PASS (5/5 and budgets); deploy `pockethost-a8-sprint2-ui-prune-deploy-932a067-20261124-v1` PASS at `932a067f6e4481263b065f24d66f33ce6f36e9c2`, HTTP 200, protected services unchanged.
- [x] Batch B1: remove eleven additional unreferenced UI files (24,009 source bytes): unused Node LAN view, brand icons and nine unused primitives. Active Node owner-access workflow stays in projects/page.tsx. At `7fe7ace0b43cfb6c77938e63be88245ef6969ab0`, `pockethost-a8-sprint2-b1-qa-7fe7ace-20261124-v1` inner QA PASS (5/5 and budgets), original npm build wrapper exit 127; separate direct Vite build `pockethost-a8-sprint2-b1-build-7fe7ace-20261124-v1` PASS; guarded deploy `pockethost-a8-sprint2-b1-deploy-7fe7ace-20261124-v1` PASS, HTTP 200 and protected services unchanged. Total 15 files / 45,282 source bytes removed.
- [x] Batch B2: removed nine direct dependencies (24 to 15), ten lockfile entries (559 to 549) and obsolete pnpm lock. Offline lock preflight `pockethost-a8-sprint2-b2-lock-preflight-a0c6591-20261124-v2` PASS; exact checksum and clean install `pockethost-a8-sprint2-b2-dependency-qa-179dc5a-20261124-v1` PASS; isolated types/build/8 Node tests/navigation `pockethost-a8-sprint2-b2-clean-build-179dc5a-20261124-v1` PASS. Guarded source refresh `pockethost-a8-sprint2-b2-source-deploy-179dc5a-20261124-v1` PASS, HTTP 200, protected services unchanged, retained versions verified; no live dependency installation or upgrades. Preserve date-fns and Vite declaration.
- [x] Batch D1: two unused helpers removed (1,387 bytes). `pockethost-a8-sprint2-d1-qa-c69cc47-20261124-v1` PASS (types/build/5 Node tests and docs/budgets); `pockethost-a8-sprint2-d1-deploy-c69cc47-20261124-v1` PASS at `c69cc47`, HTTP 200, protected services unchanged.
- [x] Batch C: six implemented modules; four placeholder scopes consolidated, eight policy/spec files removed. Structure/docs/boundaries/budgets/format/Markdown/lint PASS at `6961599` (foundation 19/20; stale archive fixture). Fixture corrected at `567ef2d`; `pockethost-a8-sprint2-c-foundation-567ef2d-20261124-v1` PASS (4/4, foundation suite). No runtime change or restart.
- [x] Batch D2: compatibility audit `pockethost-a8-sprint2-d-compatibility-audit-4904f28-20261124-v1` PASS (demo absent on A8). Preserve legacy route/API/gateway, shared flags, referenced themes and tested facades. Consolidated renderer; QA `pockethost-a8-sprint2-d2-qa-28adcdc-20261124-v1` PASS (26/26, types/build); deploy `pockethost-a8-sprint2-d2-deploy-28adcdc-20261124-v1` PASS at `28adcdc`, HTTP 200, protected services unchanged. No demo mutation.

## Sprint 3 — A8 performance (ACTIVE)

- [ ] S3A: record observed idle and bounded serial read-only HTTP load baselines (CPU, RSS, I/O, latency, process/FD counts; battery if readable). Pin live SHA/PID/start ticks and report inaccessible metrics as unknown; no customer-site writes.
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
