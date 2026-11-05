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

## Admin app gate (once full template is imported)

The pinned imported source belongs to `apps/admin` and preserves its original configuration. The root Prettier/ESLint gate excludes this vendored baseline, but the **mandatory additional native gate** runs `npm run admin:lint` and `npm run admin:build` from the PocketHost root (or the exact package-manager equivalent). All imported routes must remain present; no bypass by removing demo screens. Later edits to the app must be checked by its own linter, TypeScript build, token/style gates and browser acceptance. Import/build are `pending` until a real Termux Local Agent result proves them.

## P1 host snapshot feature gate

The new development-only read-only host snapshot must pass native Termux unit tests and negative request checks: allowlist rejection, sanitized states, GET-only API, foreign-Origin rejection and no external service control. No assumptions about real host states from fixtures. See [host overview feature checkpoint](checkpoints/2026-11-05-host-overview-work-start.md).

## Gate 2: feature code (future)

- Tests for each module's contract, input validation, failures and security boundaries.
- Integration test with a fake Termux host adapter and port conflicts.
- No regressions to externally managed services; execute tests on Termux through Local Agent, using isolated fixtures, with separate live-device evidence.
- Explicit verification record for every physical-host claim.

## Planned UI and agentic coding quality gates

After actual Termux qualification, add Vitest for contracts, Knip for unused modules and the selected GUI design system: React/Vite/TypeScript, Tailwind v4, shadcn/ui with locked `maia` preset, and `@shadcn/lint`. Treat tools as proposed until installed and run on Termux. Read [tooling evaluation](TOOLING_EVALUATION.md) and [design-system contract](DESIGN_SYSTEM.md).

UI gate requirements: forbid raw palette colors, arbitrary values, unapproved component restyling, inline style attributes and unreadable dynamic classes; enforce shared tokens, variants and component ownership. Supplement JSX lint with CSS checks, accessibility tests, responsive interactions and deterministic screenshot comparisons of a real supported phone browser/WebView. Confirm negative fixtures **fail the gate** before trusting it. Lint PASS alone is not visual PASS; Android screenshot automation requires separate device qualification.

## Workflow

Run **all** PocketHost gates, tests, installs and builds on the selected Termux phone **through Local Agent**, using an isolated project checkout. GitHub Connector may edit documentation and publish tasks, but it is not a runtime or proof of validation. A historical Linux sandbox result is background evidence only, not a current Termux pass. Record exact source commit, command, exit code, tool versions and the published host-task result. No substitution with Mac, ChatGPT Linux sandbox, GitHub Actions, Codex or ChatGPT Work. Update docs and gates together with interface/module changes. See [Termux Local Agent runbook](LOCAL_AGENT_TERMUX.md).

## Known bootstrap limitation

An installation may not have registry access or a committed `package-lock.json`. Gate 0 is executable without development dependencies; Gate 1 is configured but cannot be claimed passing until dependencies are resolved and checked **on the actual Termux target**. Do not lower gate strictness to hide unavailable tooling.
