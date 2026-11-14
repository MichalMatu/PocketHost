---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Distinguish safe deployment receipts from explicitly authorized test gates
---

# Quality and deployment evidence

A **deployment PASS** requires one real Samsung Local Agent terminal receipt with exact live source SHA, verified PocketHost ownership/readiness and unchanged protected services. A Git commit, queued task, earlier receipt or report without live evidence is **not deployed PASS**. Default FAST FLOW runs no tests.

A **test PASS** requires separately authorized, actually executed checks tied to the exact source SHA. Do not treat a deployment receipt as test evidence.

- DEV deploy — preflight, owned guarded refresh/rollback and read-only live revision/health verification; no automatic tests.
- G0 — structure/docs/boundaries/Node foundation, only on explicit test request.
- G1 — source, lint, format and TypeScript, only on explicit test request.
- G2 — Node/admin/build suite, only on explicit test request.
- G3 — physical Samsung browser/process, recovery/isolation and real-world routes, only on explicit test request.

Full current-SHA G2/G3 remain OPEN without separate receipts. No service control or public exposure follows from a DEV deployment or test.
