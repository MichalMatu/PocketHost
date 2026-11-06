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

## Upstream preservation and scoped Markdown

The root Markdown gate checks **PocketHost-owned** documentation and agent contracts only. It must not lint nested dependency trees or vendored `apps/admin` Markdown; the upstream MIT license and original template remain unchanged. The admin route-preservation tests enforce all 32 original paths plus the separate `/host` route, lazy module existence and an Android viewport without pinch-zoom suppression. These are static contracts, not substitutes for real Android browser interactions.

## Gate 1: formatting, lint, types and Markdown (Termux baseline accepted)

`npm run check` adds `markdownlint-cli2`, Prettier, ESLint and TypeScript to Gate 0. `npm install` is needed to fetch dev dependencies; commit and validate a lockfile before application development. Ruff is deliberately absent because no Python application language is selected.

## Admin app gate (once full template is imported)

The pinned imported source belongs to `apps/admin` and preserves its original configuration. The root Prettier/ESLint gate excludes this vendored baseline, but the **mandatory additional native gate** runs `npm run admin:lint` and `npm run admin:build` from the PocketHost root (or the exact package-manager equivalent). All imported routes must remain present; no bypass by removing demo screens. Later edits to the app must be checked by its own linter, TypeScript build, token/style gates and browser acceptance. Full vendor import, native app build/lint, P1 read-only HTTP and P1.1 host-health app build/lint are proven on real Termux; root Gate 1 is now verified separately at `93cba36b`; the integrated P3 candidate needs a fresh run.

## P1 host snapshot feature gate

The new development-only read-only host snapshot must pass native Termux unit tests and negative request checks: allowlist rejection, sanitized states, GET-only API, foreign-Origin rejection and no external service control. No assumptions about real host states from fixtures. See [host overview feature checkpoint](checkpoints/2026-11-05-host-overview-work-start.md).

**Actual P1 acceptance:** see [Host overview P1 checkpoint](checkpoints/2026-11-05-host-overview-work-start.md) for on-phone 18/18 tests, lint/build PASS, HTTP 200 snapshot/dashboard/host, rejected POST/foreign Origin and independently verified IleStoi.pl `running`. No native browser automation was claimed.

**Actual P1.1 acceptance:** [Host health native checkpoint](checkpoints/2026-11-05-host-health-work-start.md) records **21/21 tests, app lint/build PASS**, six service statuses including Local Agent, storage capacity/availability or unavailable sentinel, and on-device GET/POST/Origin/Host HTTP checks.

## Commercial standalone-shell acceptance

The `sprint/p1-closeout-20261105` cleanup has native Termux **26/26 tests, app lint and build PASS**, guarded live DEV preview HTTP security checks PASS and six real Android Chrome browser checks PASS. See [commercial UI checkpoint](checkpoints/2026-11-05-commercial-template-cleanup.md). The preserved source is explicitly MIT licensed. No Pro upsells, external provider account/profile or vendor shop links are rendered in the PocketHost shell.

The separate full root Gate 1 was exercised on Termux. Its initial failure was caused by an overly broad Markdown glob scanning dependencies/vendor files. A narrowed owner-document glob passes **49 files, zero errors**. Root ESLint passes, but Prettier still identifies historical formatting drift, and the initial TypeScript run exposed missing Node declarations (addressed in the working branch but pending complete root Gate 1 retest and committed root lockfile). **This was the historical Gate 1 HOLD, subsequently resolved by the exact `93cba36b` native receipt.**

## Latest P2 appearance regression and gate status

At `0645ee2`, physical Termux Local Agent validated the repaired Base UI header appearance menu: **31/31 tests PASS**, app ESLint PASS and Vite build PASS (`pockethost-appearance-menugroup-fix-native-20261105-v1`). Guarded restart (`pockethost-menugroup-guarded-restart-20261105-v1`) confirmed three UI routes and updated live module HTTP 200, read-only snapshot 200, POST 405 and foreign Origin 403. The owner manually confirmed that the prior runtime error disappeared.

**Important gate lesson:** a React/Base UI context error was invisible to static tests and build; next UI release requires an actual component/browser interaction test (menu open and Light/Dark/System, Theme/Layout, reset). Latest Android CDP could not run because ADB was disconnected. **Historical root Gate 1 HOLD from the earlier audit** `pockethost-checkpoint-gate1-complete-audit-20261105-v1`: Gate 0 31/31 PASS, Markdownlint 51/51 files zero issues, ESLint PASS, TypeScript PASS, but Prettier finds 17 files and the generated root lockfile is not yet committed. `npm run check` therefore exits 1. Admin build/lint do not imply root Gate 1 PASS. See [complete checkpoint](checkpoints/2026-11-05-pocket-host-full-checkpoint.md).

## Gate 2: feature code (P3 implementation pending device acceptance)

- Tests for each module's contract, input validation, failures and security boundaries.
- Integration test with a fake Termux host adapter and port conflicts.
- No regressions to externally managed services; execute tests on Termux through Local Agent, using isolated fixtures, with separate live-device evidence.
- Explicit verification record for every physical-host claim.

## Planned UI and agentic coding quality gates

After actual Termux qualification, add Vitest for contracts, Knip for unused modules and the selected GUI design system: React/Vite/TypeScript, Tailwind v4, shadcn/ui with the pinned ShadcnStore **Base UI/base-nova** component family, and `@shadcn/lint`. Treat tools as proposed until installed and run on Termux. Read [tooling evaluation](TOOLING_EVALUATION.md) and [design-system contract](DESIGN_SYSTEM.md).

UI gate requirements: forbid raw palette colors, arbitrary values, unapproved component restyling, inline style attributes and unreadable dynamic classes; enforce shared tokens, variants and component ownership. Supplement JSX lint with CSS checks, accessibility tests, responsive interactions and deterministic screenshot comparisons of a real supported phone browser/WebView. Confirm negative fixtures **fail the gate** before trusting it. Lint PASS alone is not visual PASS; Android screenshot automation requires separate device qualification.

## Workflow

Run **all** PocketHost gates, tests, installs and builds on the selected Termux phone **through Local Agent**, using an isolated project checkout. GitHub Connector may edit documentation and publish tasks, but it is not a runtime or proof of validation. A historical Linux sandbox result is background evidence only, not a current Termux pass. Record exact source commit, command, exit code, tool versions and the published host-task result. No substitution with Mac, ChatGPT Linux sandbox, GitHub Actions, Codex or ChatGPT Work. Update docs and gates together with interface/module changes. See [Termux Local Agent runbook](LOCAL_AGENT_TERMUX.md).

## Historical bootstrap limitation

An installation may not have registry access or a committed `package-lock.json`. Gate 0 is executable without development dependencies; Gate 1 is configured but cannot be claimed passing until dependencies are resolved and checked **on the actual Termux target**. Do not lower gate strictness to hide unavailable tooling.

## Current exact-source Gate 1 and P3 acceptance

The previous HOLD was resolved on physical Termux: `pockethost-root-gate1-published-native-20261105-v1` confirms exact `93cba36b`, clean `npm ci` and full `npm run check` PASS (31/31 Node tests, 52 Markdown documents without errors, Prettier, ESLint and TypeScript). The appearance interaction branch `3563512` also passed native jsdom click tests, admin lint and build. These independent results are **not** a PASS for the newly integrated `99fa9a3` P3 candidate.

P3 needs actual Termux lifecycle tests, negative API requests, double-start/race and failed-start cases, Android Chrome interaction and documented safe stop/rollback. The release remains HOLD while the combined candidate is unverified. See [P3 integration checkpoint](checkpoints/2026-11-05-p3-mvp-integration-candidate.md).

## Latest physical P3 acceptance boundary — 2026-11-06

Exact Termux source `f89519a892eb8222940d25877a7ba04c004a6736` was verified by `pockethost-lan-no-login-full-native-gates-20261106-v2`: `done` / exit 0 / `all_pass:true`, including LAN security tests 3/3, full root Gate 1, app lint/build, appearance UI 6/6 and a clean QA checkout. The actual cutover `pockethost-lan-login-free-gateway-cutover-20261106-v2` was `done` / exit 0 / `LAN_NO_LOGIN_RUNNING`, and independent `pockethost-lan-no-login-independent-health-20261106-v1` returned `pass:true`.

The owner supplied two real Mac Chrome screenshots (03:27 Europe/Warsaw) and confirmed the panel and demo page work without login. **Visual LAN gate PASS; actual GUI publish/rollback click gate OPEN.** These screenshots are not browser-mutation evidence. See [LAN acceptance](checkpoints/2026-11-06-local-network-access.md).
