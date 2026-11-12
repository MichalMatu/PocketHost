---
status: active
owner: core
last_reviewed: 2026-11-12
purpose: Short execution plan that implements the canonical roadmap without duplicate history
---

# PocketHost Development Plan

## Operating rhythm

Use fresh main and [FAST FLOW](DEV_ITERATION.md): change one
coherent component, run only mapped Node/Vitest and applicable
lint/type checks on verified Samsung Termux Local Agent, preserve
caches, and use existing Vite HMR. Do not rerun successful unrelated
suites, install packages repeatedly, create duplicate environments
or treat task publication as PASS. Close a milestone with its
remaining G1/G2 and separate physical G3 evidence.

## Next development path

1. **M0 acceptance closure:** separate source from device acceptance.
   Consume already published native receipts first; repair only
   confirmed failures. For static Hosting, verify disposable
   Create/Start/Publish/Rollback and protected-service invariants.
2. **M1 identity foundation:** keep one pure declaration validator
   and one host-owned revisioned private store. Complete exact-SHA
   focused negative QA for owner identity, locks, symlinks, stale
   revisions, rollback/restore and migration rejection. No live
   process or service registration by inference.
3. **M2 minimum shared adapter:** preview project-local dependency
   plans, verified runit service adapter, manual-down-aware
   cooldown/retry policy and scoped backup/restore. Prove with
   disposable fixtures and failure cases, not a new daemon.
4. **M3 first usable product:** browser Create Project for one
   disposable Node app using an explicit lockfile, staging,
   owned port, readiness, logs, publish and rollback. Keep H2
   static hosting functioning; do not wait for optional
   Cloudflare, Python or a full template marketplace.
5. **Later modules and migrations:** only after M3 proves the
   reusable contracts and separate target-specific hardware
   acceptance. See [M4–M7](ROADMAP.md).

**Immediate gate before more features:** accept the pending [repository
repair checkpoint](checkpoints/2026-11-12-general-repository-repair-continuation.md)
with exact-source Samsung tests and one milestone G2. If no authenticated
Local Agent terminal result is available, retain HOLD and do not claim
deployment or quality acceptance.

## Change discipline

- Source/UI ownership: [code map](CODE_MAP.md) and nearest AGENTS.md.
- Architecture contracts: [ARCHITECTURE](ARCHITECTURE.md) and
  [MODULES](MODULES.md); host filesystem/process work stays in host.
- Reuse: existing PocketHost, official Termux CLI and approved
  libraries before new framework; verify license/Termux support.
- Tests: dependent files first, negative host tests when touching
  privileges. No no-op formatting rewrites across unaffected files.
- Evidence: exact-SHA status, short failure excerpt and actionable
  next step in a checkpoint; **no duplicated chronological status**
  in ROADMAP, QUALITY_GATES or this plan.

See [current handoff](HANDOFF_NEXT_CHAT.md) for incomplete acceptance,
and [checkpoint archive](checkpoints/README.md) for previously
accepted older scopes. The old extended development chronology is
recoverable in Git history at 685daea477ab5e4de63e8bd99bf20c10c7647bd9.
