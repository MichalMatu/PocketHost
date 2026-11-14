---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Exact-source evidence semantics
---

# Quality gates

PASS requires an actual Samsung Local Agent terminal result, exact source SHA and named executed checks. A commit, queued task or previous SHA is **not** PASS.

- DEV — impacted tests, optional incremental TS, changed-doc checks, owner UI review.
- G0 — structure/docs/boundaries/Node foundation.
- G1 — source, lint, format and TS.
- G2 — full Node/admin/build suite.
- G3 — physical phone browser/process, ownership, protected-service invariants, rollback, recovery and real-world routes.

Current-SHA full G2/G3 are OPEN without separate receipts. No service control or public exposure follows from DEV tests.
