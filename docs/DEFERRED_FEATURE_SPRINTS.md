---
status: active
owner: product
last_reviewed: 2026-11-25
purpose: Deferred feature sprint dependencies and acceptance requirements
---

# Deferred post-UX feature backlog

## Sprint 8 — HTTP performance and traffic latency (DEFERRED AFTER UX-07 — TODO)

Extends S3 and S5 without changing process ownership.

- [ ] S8A: establish exact-SHA A8 baseline with representative compressible/incompressible assets, GET/HEAD, concurrent traffic, CPU, RSS, response bytes and latency. Evaluate gzip only where net benefit is measured; retain per-site process model.
- [ ] S8B: implement bounded static compression if justified, respecting Accept-Encoding quality, Content-Encoding/Vary, HEAD parity, release identity, existing cache policy and unchanged fallback bytes. Do not compress arbitrary Node traffic or duplicate upstream process code.
- [ ] S8C: extend completed-response traffic aggregates with bounded latency statistics (explicit units, counts, missing state, schema migration/retention). Preserve 24h/7d, existing byte semantics and old snapshots; distinguish application response time from synthetic health probes. No per-request SQL or unbounded histories.
- [ ] S8D: prove correctness, measured A8 resource budgets and regression behavior. If gzip or a latency metric fails the measured gate, document rejection rather than force adoption. Exact-SHA QA and guarded deploy/readback; confirm existing-project traffic collection on normal subsequent starts, without restarting unrelated workloads.

## Sprint 9 — File Manager Pro and project dependencies (DEFERRED AFTER UX-07 — TODO)

Keep file and package changes as separate verified batches; use staged releases, not in-place edits of active deployments.

- [ ] S9A: compare upstream ZIP create/extract, multi-selection and file actions with the existing TermuxFileExplorer and Static bundle import/export. Fill only verified gaps; scope project actions to owned staging, enforce archive entry/size/count limits and preserve rollback.
- [ ] S9B: add useful selection, archive preview and explicit batch outcomes with path/identity checks, cancellation and stale-selection handling. Test malformed archives, partial failures, foreign paths and protected services; no real-data batch operations without separate approval.
- [ ] S9C: compare upstream package inventory/install/remove/update with existing Node dependency review and NodeDependencyPreparer. Add missing read-only per-project inventory and candidate manifest/lock changes through current staged dependency/build flow; no npm update or pip install in a live runtime, no host-global changes. Python packages stay in S12.
- [ ] S9D: separate exact-SHA QA and guarded deploy/readback for file and dependency batches. Preserve known immutable release and dependency attestation contracts.

## Sprint 10 — Monitoring and optional notifications (DEFERRED AFTER UX-07 — TODO)

Depends on S8 telemetry and existing runit readiness contracts.

- [ ] S10A: reuse existing on-demand owned health probes and add bounded history/latency presentation for observations that actually occur. Distinguish stopped, unknown and unhealthy; show observed coverage and never infer continuous uptime from sparse samples.
- [ ] S10B: evaluate upstream Telegram/Discord event notifications; design deduplicated, rate-limited alerts for existing verified events, explicit delivery status and no secrets in UI/task output. External delivery and real credentials require distinct owner approval; fixtures only until then.
- [ ] S10C: no new polling daemon, cron or auto-healer. Any continuous monitoring cadence or external alerts require separate owner scope. Keep runit the sole supervisor; do not restart apps because a dashboard observation fails.
- [ ] S10D: exact-SHA A8 QA and guarded deploy/readback for approved local functionality; use fake notification transport for tests. Record separately whether external delivery is approved/qualified.

## Sprint 11 — GitHub Auto Deploy (DEFERRED AFTER UX-07 — TODO — GATED)

Depends on S7/S9 candidate creation and S10 visibility; reuse existing GitHub preview, immutable source/release, dependency/build, owner and rollback contracts.

- [ ] S11A: design and test an opt-in per-project deployment intent pinned to repository/branch/commit; replay/idempotency, concurrency and stale candidate checks. Use isolated signed-event fixtures, never an automatic git pull/npm install/restart in the active tree.
- [ ] S11B: map valid events to the existing staged review and guarded deployment; keep failures visible, retain prior release, verify exact source and protected services. Automatic application of reviewed policy requires distinct owner consent.
- [ ] S11C: external webhook ingress, credentials, signature verification, public exposure and trust policy require an explicitly approved separate scope; do not expose the LAN admin or route tasks through a competing agent/scheduler. Until approved, qualify local fixtures only and retain manual deployment.
- [ ] S11D: exact-SHA A8 QA and guarded deploy/readback of any approved local changes. External end-to-end acceptance remains gated; no claim of live auto-deploy from fixture results.

## Sprint 12 — Python/PHP Hosting (DEFERRED AFTER UX-07 — TODO — GATED)

Depends on closed or explicitly deferred S11 and accepted shared staging, ownership, dependency and readiness contracts. Separate owner authorization for additional runtimes/host package changes.

- [ ] S12A: compare upstream Python/PHP launchers/templates with the existing Static/Node host and runit contract. Design runtime-specific adapters with resource limits, private assigned ports, immutable releases and rollback; no untrusted code isolation claim.
- [ ] S12B: qualify one runtime at a time in isolated A8 fixtures, including dependency versions (private Python environment), start/stop/health/logs, crash containment, upgrades and rollback. No global pip installs or blanket package changes.
- [ ] S12C: exact-SHA QA and guarded deployment per runtime after approval. Reject or defer unsupported/resource-heavy capabilities rather than weaken the current runtime.
