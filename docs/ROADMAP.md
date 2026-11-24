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
- [x] Opt-in standalone Termux installer source and manifest/structure/docs QA at b8d67ba; see [installation](INSTALLATION.md). Clean-device unqualified.

## Sprint 1 — v1.0.1: Static Hosting lifecycle (CLOSED)

- [x] Source diagnosis: whole-site deletion missing in UI, API and SiteFleetHost; eight-site limit cannot be reclaimed.
- [x] Implement explicit owned-site removal, including last site and empty catalog; safe stopped/verified process state, scoped filesystem validation, freed allocation, no foreign service impact; deliberate UI confirmation and inventory readback.
- [x] Test empty and populated site removal, running/unknown refusal or verified stop, foreign paths, symlinks, concurrent/stale writes, failure outcomes, last-site empty state and capacity/port reuse; test isolated fixtures only.
- [x] Exact-SHA A8 QA, separate guarded DEV deployment/readback, document evidence.

Runtime `120adca4fcb9ee4cc089b58994bc0a87ca35f583`: QA `pockethost-a8-static-removal-qa-120adca-20261124-v1` PASS (12/12 checks plus code budgets); separate deploy `pockethost-a8-static-removal-deploy-120adca-20261124-v1` PASS, HTTP 200; protected unchanged. Additional test-only coverage for eight-site capacity, concurrent mutations, uncertain PID and occupied port: exact A8 QA `pockethost-a8-static-edge-qa-bf671cf-20261124-v1` PASS (4/4 checks) at `bf671cf9f1893cf9e2c8606c21e55b1c46f1351c`. No real sites deleted.

## Sprint 2 — simplify and remove unused code (CLOSED)

- [x] Measure dead code/dependencies with import/route references and available analysis tooling before deleting anything.
- [x] Evaluate legacy demo, placeholder modules, duplicate facades and themes; remove only proven unused parts, preserve used workflows and compatibility.
- [x] Targeted regression tests, dependency/structure checks and guarded A8 verification where applicable.

Audit `pockethost-a8-sprint2-reference-audit-24979fd-20261124-v2` PASS at `24979fd` (473 files). No Knip download.

- [x] Batch A: four unused UI components removed (21,273 bytes). QA `pockethost-a8-sprint2-ui-prune-qa-932a067-20261124-v1` PASS (5/5 and budgets); deploy `pockethost-a8-sprint2-ui-prune-deploy-932a067-20261124-v1` PASS at `932a067f6e4481263b065f24d66f33ce6f36e9c2`, HTTP 200, protected unchanged.
- [x] Batch B1: eleven unused UI files removed (24,009 bytes); active Node owner workflow retained. At `7fe7ace0b43cfb6c77938e63be88245ef6969ab0`, `pockethost-a8-sprint2-b1-qa-7fe7ace-20261124-v1` inner QA PASS (5/5 and budgets), npm wrapper exit 127; direct build `pockethost-a8-sprint2-b1-build-7fe7ace-20261124-v1` PASS; guarded deploy `pockethost-a8-sprint2-b1-deploy-7fe7ace-20261124-v1` PASS, HTTP 200, protected unchanged.
- [x] Batch B2: removed nine direct dependencies (24 to 15), ten lockfile entries (559 to 549) and pnpm lock. Offline lock preflight `pockethost-a8-sprint2-b2-lock-preflight-a0c6591-20261124-v2` PASS; exact checksum and clean install `pockethost-a8-sprint2-b2-dependency-qa-179dc5a-20261124-v1` PASS; isolated types/build/8 Node tests/navigation `pockethost-a8-sprint2-b2-clean-build-179dc5a-20261124-v1` PASS. Refresh `pockethost-a8-sprint2-b2-source-deploy-179dc5a-20261124-v1` PASS, HTTP 200, protected services unchanged, retained versions verified; live dependencies untouched.
- [x] Batch D1: two unused helpers removed (1,387 bytes). `pockethost-a8-sprint2-d1-qa-c69cc47-20261124-v1` PASS (types/build/5 Node tests and docs/budgets); `pockethost-a8-sprint2-d1-deploy-c69cc47-20261124-v1` PASS at `c69cc47`, HTTP 200, protected services unchanged.
- [x] Batch C: six implemented modules; four placeholder scopes consolidated, eight policy/spec files removed. Structure/docs/boundaries/budgets/format/Markdown/lint PASS at `6961599` (foundation 19/20; stale archive fixture). Fixture corrected at `567ef2d`; `pockethost-a8-sprint2-c-foundation-567ef2d-20261124-v1` PASS (4/4, foundation suite). No restart.
- [x] Batch D2: compatibility audit `pockethost-a8-sprint2-d-compatibility-audit-4904f28-20261124-v1` PASS (demo absent on A8). Preserve legacy route/API/gateway, shared flags, referenced themes and tested facades. Consolidated renderer; QA `pockethost-a8-sprint2-d2-qa-28adcdc-20261124-v1` PASS (26/26, types/build); deploy `pockethost-a8-sprint2-d2-deploy-28adcdc-20261124-v1` PASS at `28adcdc`, HTTP 200, protected services unchanged.

## Sprint 3 — A8 performance (CLOSED)

- [x] S3A: `pockethost-a8-sprint3-a-baseline-dd9d527-20261124-v1` PASS at live `28adcdc`: idle CPU 0.4–2.39% of one core/RSS 195380 KiB; load 34.24%/203656 KiB. Median ms: sites 75.08, sites API 31.65, snapshot 560.61; 15/15 HTTP 200. One running site.
- [x] S3B: `pockethost-a8-sprint3-b-runit-profile-6fd2cc1-20261124-v1` PASS: 7 services, 3/3 identical full projections; median 201.28 → 37.54 ms (81.35% less); static process RSS 39661568 bytes.
- [x] S3C: snapshot batch only; lifecycle probes unchanged. `pockethost-a8-sprint3-c-qa-8f933f0-20261124-v1` PASS (9/9, build, 3/3 equal projections; median 165.51 → 39.66 ms); `pockethost-a8-sprint3-c-deploy-8f933f0-20261124-v1` PASS, HTTP 200, protected unchanged.
- [x] S3D: `pockethost-a8-sprint3-c-postbaseline-8f933f0-20261124-v1` PASS: live snapshot median 560.61 → 119.90 ms (-78.6%), 15/15 HTTP 200; load RSS 203656 → 199984 KiB. No idle CPU gain.
- [x] S3E: `pockethost-a8-sprint3-e-static-profile-892a938-20261124-v1` PASS: 90/90 responses, 3 separate vs 1 shared process; end RSS 212204 → 73508 KiB, CPU ticks 108 → 77. Keep separate ownership/PID lifecycle; shared migration needs explicit isolation and recovery design. RSS is not PSS.
- [x] S3F: `pockethost-a8-sprint3-f-vite-profile-8e630e3-20261124-v1` PASS: frontend-only DEV/preview 24/24 HTTP 200; end RSS 389424/83148 KiB; PSS unavailable. Not full-page/API equivalent.
- [x] S3G: decision recorded in [architecture](ARCHITECTURE.md): retain static lifecycle, extract API composition before any built UI switch; no speculative I/O/cache changes.

## Sprint 4 — architecture and test quality (ACTIVE)

- [x] S4A: host snapshot adapter; `pockethost-a8-sprint4-a-qa-eaaebf0-20261124-v1` PASS (29 Node, 25 UI); `pockethost-a8-sprint4-a-deploy-eaaebf0-20261124-v1` PASS, HTTP 200.
- [x] S4B: monitoring adapters; `pockethost-a8-sprint4-b-qa-916b420-20261124-v1` PASS (53 Node, 25 UI); `pockethost-a8-sprint4-b-deploy-916b420-20261124-v1` PASS.
- [x] S4C: Termux/Shizuku; `pockethost-a8-sprint4-c-qa-1d153dd-20261124-v1` PASS (22 Node, 43 UI); `pockethost-a8-sprint4-c-deploy-1d153dd-20261124-v1` PASS.
- [x] S4D: hosting/LAN; `pockethost-a8-sprint4-d-qa-b619114-20261124-v1` PASS (70 Node, 66 UI); `pockethost-a8-sprint4-d-deploy-b619114-20261124-v1` PASS.
- [ ] S4E1: Termux API composition/read/action/context split; preserve serialization.
- [ ] S4E2: split large host modules; consolidate contracts and boundaries.
- [ ] S4F: integration, recovery/endurance and final regression; reconcile docs.
- [ ] Evaluate standalone updater and clean-device acceptance separately; physical install/reboot/real data need separate scope.

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

Resume from [handoff](HANDOFF_NEXT_CHAT.md) and this checklist.
