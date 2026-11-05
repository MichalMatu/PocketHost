---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Define mandatory foundation and future app quality checks
---

# Quality Gates

## Gate 0: documentation and structure (mandatory now)

`npm run check:foundation` executes dependency-free layout validation, document validation and Node tests. The checks verify:

- Exact required foundation files and allowed top-level directories.
- Explicit module inventory, dedicated module instructions and design documents.
- No unapproved module directories or unexpected code placed outside declared boundaries.
- Static cross-module import enforcement and exclusive host-adapter OS access.
- Frontmatter (`status`, `owner`, `last_reviewed`, `purpose`) on governed docs; indexed module specifications.
- Valid local Markdown links and required `AGENTS.md` sections.
- Intentional negative tests for missing, illegal and malformed structural artifacts.

## Gate 1: formatting, lint, types and Markdown (tooling configured)

`npm run check` adds `markdownlint-cli2`, Prettier, ESLint and TypeScript to Gate 0. `npm install` is needed to fetch dev dependencies; commit and validate a lockfile before application development. Ruff is deliberately absent because no Python application language is selected.

## Gate 2: feature code (future)

- Tests for each module's contract, input validation, failures and security boundaries.
- Integration test with a fake Termux host adapter and port conflicts.
- No regressions to externally managed services; test on sandbox and separately on device.
- Explicit verification record for every physical-host claim.

## Workflow

Run gates locally in a recreated Linux sandbox before each merge. Use Local Agent only for permitted on-device operations. GitHub Actions are not part of the workflow. Update docs and gates together with interface/module changes.

## Known bootstrap limitation

The initial environment may not allow npm registry access. Gate 0 is still executable without dependencies; Gate 1 is configured but cannot be claimed passing before dependencies are installed and checked. Do not lower gate strictness to hide unavailable tooling.
