---
status: active
owner: product
last_reviewed: 2026-11-25
purpose: Ordered post-v1 sprint backlog and completion evidence
---

# PocketHost — post-v1 roadmap

**FROZEN after S7 — owner-directed pause, 2026-11-25.** S1–S7 are closed. S8–S12 are retained for future review; do not start them, schedule tasks or change the device without a new explicit implementation instruction.

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

- [x] Batch A: four unused UI components removed (21,273 bytes). QA `pockethost-a8-sprint2-ui-prune-qa-932a067-20261124-v1` PASS (5/5 and budgets); deploy `pockethost-a8-sprint2-ui-prune-deploy-932a067-20261124-v1` PASS at `932a067f6e4481263b065f24d66f33ce6f36e9c2`, HTTP 200.
- [x] Batch B1: eleven unused UI files removed (24,009 bytes); active Node owner workflow retained. At `7fe7ace0b43cfb6c77938e63be88245ef6969ab0`, `pockethost-a8-sprint2-b1-qa-7fe7ace-20261124-v1` inner QA PASS (5/5 and budgets), npm wrapper exit 127; direct build `pockethost-a8-sprint2-b1-build-7fe7ace-20261124-v1` PASS; guarded deploy `pockethost-a8-sprint2-b1-deploy-7fe7ace-20261124-v1` PASS, HTTP 200, protected unchanged.
- [x] Batch B2: removed nine direct dependencies (24 to 15), ten lockfile entries (559 to 549) and pnpm lock. Offline lock preflight `pockethost-a8-sprint2-b2-lock-preflight-a0c6591-20261124-v2` PASS; exact checksum and clean install `pockethost-a8-sprint2-b2-dependency-qa-179dc5a-20261124-v1` PASS; isolated types/build/8 Node tests/navigation `pockethost-a8-sprint2-b2-clean-build-179dc5a-20261124-v1` PASS. Refresh `pockethost-a8-sprint2-b2-source-deploy-179dc5a-20261124-v1` PASS, HTTP 200, protected unchanged, retained versions verified; live dependencies untouched.
- [x] Batch D1: two unused helpers removed (1,387 bytes). `pockethost-a8-sprint2-d1-qa-c69cc47-20261124-v1` PASS (types/build/5 Node tests and docs/budgets); `pockethost-a8-sprint2-d1-deploy-c69cc47-20261124-v1` PASS at `c69cc47`, HTTP 200, protected unchanged.
- [x] Batch C: six implemented modules; four placeholder scopes consolidated, eight policy/spec files removed. Structure/docs/boundaries/budgets/format/Markdown/lint PASS at `6961599` (foundation 19/20; stale archive fixture). Fixture corrected at `567ef2d`; `pockethost-a8-sprint2-c-foundation-567ef2d-20261124-v1` PASS (4/4, foundation suite). No restart.
- [x] Batch D2: compatibility audit `pockethost-a8-sprint2-d-compatibility-audit-4904f28-20261124-v1` PASS (demo absent on A8). Preserve legacy route/API/gateway, shared flags, referenced themes and tested facades. Consolidated renderer; QA `pockethost-a8-sprint2-d2-qa-28adcdc-20261124-v1` PASS (26/26, types/build); deploy `pockethost-a8-sprint2-d2-deploy-28adcdc-20261124-v1` PASS at `28adcdc`, HTTP 200, protected unchanged.

## Sprint 3 — A8 performance (CLOSED)

- [x] S3A: `pockethost-a8-sprint3-a-baseline-dd9d527-20261124-v1` PASS at live `28adcdc`: idle CPU 0.4–2.39% of one core/RSS 195380 KiB; load 34.24%/203656 KiB. Median ms: sites 75.08, sites API 31.65, snapshot 560.61; 15/15 HTTP 200. One running site.
- [x] S3B: `pockethost-a8-sprint3-b-runit-profile-6fd2cc1-20261124-v1` PASS: 7 services, 3/3 identical full projections; median 201.28 → 37.54 ms (81.35% less); static process RSS 39661568 bytes.
- [x] S3C: snapshot batch only; lifecycle probes unchanged. `pockethost-a8-sprint3-c-qa-8f933f0-20261124-v1` PASS (9/9, build, 3/3 equal projections; median 165.51 → 39.66 ms); `pockethost-a8-sprint3-c-deploy-8f933f0-20261124-v1` PASS, HTTP 200, protected unchanged.
- [x] S3D: `pockethost-a8-sprint3-c-postbaseline-8f933f0-20261124-v1` PASS: live snapshot median 560.61 → 119.90 ms (-78.6%), 15/15 HTTP 200; load RSS 203656 → 199984 KiB. No idle CPU gain.
- [x] S3E: `pockethost-a8-sprint3-e-static-profile-892a938-20261124-v1` PASS: 90/90 responses, 3 separate vs 1 shared process; end RSS 212204 → 73508 KiB, CPU ticks 108 → 77. Keep separate ownership/PID lifecycle; shared migration needs explicit isolation and recovery design. RSS is not PSS.
- [x] S3F: `pockethost-a8-sprint3-f-vite-profile-8e630e3-20261124-v1` PASS: frontend-only DEV/preview 24/24 HTTP 200; end RSS 389424/83148 KiB; PSS unavailable. Not full-page/API equivalent.
- [x] S3G: decision recorded in [architecture](ARCHITECTURE.md): retain static lifecycle, extract API composition before any built UI switch; no speculative I/O/cache changes.

## Sprint 4 — architecture and test quality (CLOSED)

A8 QA/deploy PASS; immutable receipts: `pockethost-a8-sprint4-<step>-<qa|deploy>-<sha>-20261124-v1`.

- [x] S4A: snapshot adapter; `eaaebf0` (29 Node, 25 UI).
- [x] S4B: monitoring; `916b420` (53 Node, 25 UI).
- [x] S4C: Termux/Shizuku; `1d153dd` (22 Node, 43 UI).
- [x] S4D: hosting/LAN; `b619114` (70 Node, 66 UI).
- [x] S4E1: Termux API; `38cb4cd` (46 Node, 67 UI).
- [x] S4E2: runtime helpers, registry I/O, strict typing; `911953d` (12 checks, build; HTTP 200, protected unchanged).
- [x] S4E3: browser/host boundary QA PASS at `c21b278`.
- [x] S4F: layered regression, backup session fix, guarded deploy `08caecc` PASS; HTTP 200. See [quality evidence](QUALITY_GATES.md). Physical recovery/endurance qualification remains separate.
- [ ] Standalone updater/clean-device acceptance separately scoped.

## Sprint 5 — v1.1: Traffic Analytics (CLOSED)

- [x] Upstream MIT review; independent per-project implementation, no extra supervisor.
- [x] Static/Node requests, status codes, response bytes, top paths, 24h/7d history and RPS; bounded retention and storage.
- [x] A8 integration, affected UI, benchmark, build, guarded deployment and live API readback PASS.

Runtime `b49b81a`: 10/10 final QA checks, 143/143 affected UI tests at `66b46ea` (UI unchanged). See [quality evidence](QUALITY_GATES.md) and [architecture](ARCHITECTURE.md).

## Sprint 6 — SQLite Studio (CLOSED)

- [x] S6A: review the upstream database UX and the existing `NodeProjectDataScope` ownership/data contracts. On the A8, compare installed SQLite capabilities (including CLI/native Node availability and sql.js only if needed) in isolated fixtures. Select the smallest bounded, read-only adapter with verified WAL/consistency behavior; do not assume a main-file copy reflects committed WAL changes.
- [x] S6B: discover SQLite files only in the selected verified owned Node project's private `db` category, never in the host or other projects. Use opaque scoped identities, verified paths, bounded file/scan/time/response sizes, explicit unsupported/locked/corrupt states. No arbitrary SQL, create/delete/import/export of live databases, or writes/replacements.
- [x] S6C: typed GET contracts and project-scoped database picker, schema, table/view list and paginated rows. Handle quoted identifiers, empty tables, BLOBs, large values and stale UI responses; no unbounded COUNT or query. If safe live reads cannot be established, expose an explicit offline-only state rather than forcing stops or inventing consistency.
- [x] S6D: isolated A8 fixtures for WAL, identity changes, symlinks/hardlinks, malformed files, page bounds, concurrent writes/reads, data invariance and UI errors; measure CPU/RSS/latency. Exact-SHA QA, separate guarded DEV deploy/readback. No real data mutation or backup/recovery claim.

Runtime `e11ee09`: S6A native SQLite capability PASS; exact A8 QA 15/15, budgets/build PASS, isolated benchmark 10/10 (median 976.5 ms, main/WAL unchanged), separate guarded deployment PASS, live SHA and HTTP 200 confirmed. SHM coordination may change; hardlink coverage is filesystem-dependent. See [quality evidence](QUALITY_GATES.md) and [architecture](ARCHITECTURE.md).

## Sprint 7 — Application Starters (CLOSED)

Depends on S6 closure; keep the existing HTML starter and Node example/import flows.

- [x] S7A: compare upstream HTML/CSS and Node HTTP examples with existing `starterHtml`, Node manifest/lock/source examples and import flows. Enumerate actual missing templates; skip equivalent ones.
- [x] S7B: add useful self-contained Static/Node templates (e.g. static multi-file site, minimal JSON API; optional SQLite example only after S6 contracts are established). Preserve assigned port, loopback policy, immutable staged release, reviewed dependency/build plan and no automatic start.
- [x] S7C: verify template selection, generated files/lock consistency, cancellation, create/stage/deploy/rollback in isolated fixtures. Exact-SHA QA and separate guarded DEV deploy/readback. No Python/PHP before S12.

Runtime `baeacfb`: 191/191 UI tests across 24 files, exact-source format/lint/types, code budgets and build PASS. Isolated Static HTML/CSS serve/rollback and Node manifest/lock/staging, loopback JSON/readiness/404 and candidate rollback PASS. Guarded DEV deployment and live SHA/HTTP readback PASS. SQLite starter intentionally deferred; no new dependency or automatic application start. See [quality evidence](QUALITY_GATES.md).

## Sprint 8 — HTTP performance and traffic latency (FROZEN — TODO)

Extends S3 and S5 without changing process ownership.

- [ ] S8A: establish exact-SHA A8 baseline with representative compressible/incompressible assets, GET/HEAD, concurrent traffic, CPU, RSS, response bytes and latency. Evaluate gzip only where net benefit is measured; retain per-site process model.
- [ ] S8B: implement bounded static compression if justified, respecting Accept-Encoding quality, Content-Encoding/Vary, HEAD parity, release identity, existing cache policy and unchanged fallback bytes. Do not compress arbitrary Node traffic or duplicate upstream process code.
- [ ] S8C: extend completed-response traffic aggregates with bounded latency statistics (explicit units, counts, missing state, schema migration/retention). Preserve 24h/7d, existing byte semantics and old snapshots; distinguish application response time from synthetic health probes. No per-request SQL or unbounded histories.
- [ ] S8D: prove correctness, measured A8 resource budgets and regression behavior. If gzip or a latency metric fails the measured gate, document rejection rather than force adoption. Exact-SHA QA and guarded deploy/readback; confirm existing-project traffic collection on normal subsequent starts, without restarting unrelated workloads.

## Sprint 9 — File Manager Pro and project dependencies (FROZEN — TODO)

Keep file and package changes as separate verified batches; use staged releases, not in-place edits of active deployments.

- [ ] S9A: compare upstream ZIP create/extract, multi-selection and file actions with the existing TermuxFileExplorer and Static bundle import/export. Fill only verified gaps; scope project actions to owned staging, enforce archive entry/size/count limits and preserve rollback.
- [ ] S9B: add useful selection, archive preview and explicit batch outcomes with path/identity checks, cancellation and stale-selection handling. Test malformed archives, partial failures, foreign paths and protected services; no real-data batch operations without separate approval.
- [ ] S9C: compare upstream package inventory/install/remove/update with existing Node dependency review and NodeDependencyPreparer. Add missing read-only per-project inventory and candidate manifest/lock changes through current staged dependency/build flow; no npm update or pip install in a live runtime, no host-global changes. Python packages stay in S12.
- [ ] S9D: separate exact-SHA QA and guarded deploy/readback for file and dependency batches. Preserve known immutable release and dependency attestation contracts.

## Sprint 10 — Monitoring and optional notifications (FROZEN — TODO)

Depends on S8 telemetry and existing runit readiness contracts.

- [ ] S10A: reuse existing on-demand owned health probes and add bounded history/latency presentation for observations that actually occur. Distinguish stopped, unknown and unhealthy; show observed coverage and never infer continuous uptime from sparse samples.
- [ ] S10B: evaluate upstream Telegram/Discord event notifications; design deduplicated, rate-limited alerts for existing verified events, explicit delivery status and no secrets in UI/task output. External delivery and real credentials require distinct owner approval; fixtures only until then.
- [ ] S10C: no new polling daemon, cron or auto-healer. Any continuous monitoring cadence or external alerts require separate owner scope. Keep runit the sole supervisor; do not restart apps because a dashboard observation fails.
- [ ] S10D: exact-SHA A8 QA and guarded deploy/readback for approved local functionality; use fake notification transport for tests. Record separately whether external delivery is approved/qualified.

## Sprint 11 — GitHub Auto Deploy (FROZEN — TODO — GATED)

Depends on S7/S9 candidate creation and S10 visibility; reuse existing GitHub preview, immutable source/release, dependency/build, owner and rollback contracts.

- [ ] S11A: design and test an opt-in per-project deployment intent pinned to repository/branch/commit; replay/idempotency, concurrency and stale candidate checks. Use isolated signed-event fixtures, never an automatic git pull/npm install/restart in the active tree.
- [ ] S11B: map valid events to the existing staged review and guarded deployment; keep failures visible, retain prior release, verify exact source and protected services. Automatic application of reviewed policy requires distinct owner consent.
- [ ] S11C: external webhook ingress, credentials, signature verification, public exposure and trust policy require an explicitly approved separate scope; do not expose the LAN admin or route tasks through a competing agent/scheduler. Until approved, qualify local fixtures only and retain manual deployment.
- [ ] S11D: exact-SHA A8 QA and guarded deploy/readback of any approved local changes. External end-to-end acceptance remains gated; no claim of live auto-deploy from fixture results.

## Sprint 12 — Python/PHP Hosting (FROZEN — TODO — GATED)

Depends on closed or explicitly deferred S11 and accepted shared staging, ownership, dependency and readiness contracts. Separate owner authorization for additional runtimes/host package changes.

- [ ] S12A: compare upstream Python/PHP launchers/templates with the existing Static/Node host and runit contract. Design runtime-specific adapters with resource limits, private assigned ports, immutable releases and rollback; no untrusted code isolation claim.
- [ ] S12B: qualify one runtime at a time in isolated A8 fixtures, including dependency versions (private Python environment), start/stop/health/logs, crash containment, upgrades and rollback. No global pip installs or blanket package changes.
- [ ] S12C: exact-SHA QA and guarded deployment per runtime after approval. Reject or defer unsupported/resource-heavy capabilities rather than weaken the current runtime.

## Cloudflare publishing (CF1 — owner resumed)

See [Cloudflare roadmap](CLOUDFLARE_ROADMAP.md) for CF1–CF5 scope, UX integration and qualification. CF1 preflight is the only resumed work; S8–S12 remain frozen.

## Deferred / separate owner scope

TeleDrive (Telegram file transport), email routing, off-device disaster recovery, physical Android reboot G3, standalone updater/clean-device acceptance, extended endurance, public ingress, untrusted-code isolation and the security sprint remain optional separate decisions. Do not treat upstream cron/watchdog, process manager, backup commands or whole Express backend as adoption candidates. Preserve the trusted-LAN MVP, protected services, independent Local Agent and MIT notices for any copied source.

## Cross-sprint acceptance

One sprint at a time; preserve completed S1–S5 and their existing evidence. Before each new runtime batch, inspect fresh main, actual A8 live SHA, pending tasks, nearest rules and both relevant source implementations. Separate exact-SHA scoped QA from guarded DEV deployment; document terminal receipts, baseline/limits and explicit NOT RUN/HOLD/deferred states. Reuse existing tests and avoid repeating passed scopes without relevant changes. Documentation-only updates do not run A8 tasks. See [upstream source audit](UPSTREAM_REUSE_STRATEGY.md) for rationale, and [handoff](HANDOFF_NEXT_CHAT.md) for resume.
