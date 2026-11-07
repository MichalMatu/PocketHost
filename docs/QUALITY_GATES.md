---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-06
purpose: Define current mandatory gates and release holds; historical QA belongs in checkpoints
---

# Quality Gates

## Scope and execution

All PocketHost project commands, dependency installation, builds and tests run **only on the exact
Samsung Termux host via Local Agent**. GitHub Connector publishes source and immutable task
requests; it does not verify execution. No GitHub Actions, Codex, ChatGPT Work or Mac/Linux
fallback. Require a terminal task result with the exact source SHA, command and exit code.
Do not rerun an already accepted gate at the same source SHA solely to generate documentation.

## G0 — structure, documentation and contracts

Run `npm run check:foundation`:

- Verify manifest-controlled module/file layout and project-owned Markdown links/frontmatter.
- Verify project and checkpoint archive indexes, including negative fixtures for missing entries.
- Enforce host-only filesystem/process/network access and deny cross-module internal imports.
- Run deterministic Node contract/negative tests; keep external and imported projects read-only.
- Preserve upstream admin routes, licenses and original vendor code until a reviewed change.

Historical evidence lives in the [checkpoint archive](checkpoints/README.md), not in an active to-do list.

## G1 — project source quality

Run `npm run check` for G0 plus Markdownlint, Prettier, ESLint and TypeScript.
Use committed lockfiles and the already qualified Termux dependency installation.
Never lower gate strictness because a package or registry is unavailable.

## G2 — full admin and integration quality

Run **`npm run check:all`** after any source change that may affect the product.
It runs G1 followed by `admin:lint`, `admin:build` and
`npm --prefix apps/admin run test:ui` (Vitest). Root and admin packages are distinct;
passing `npm run check` alone does **not** prove admin compilation or UI interactions.

Feature tests must cover valid and adversarial inputs, timeouts, ownership, symlinks,
file/process/port collisions, failed spawn, recovery, and negative HTTP requests. A fake
adapter test is not a physical-host acceptance. Keep the precise code SHA in the receipt.

## G3 — hardware, browser and release acceptance

For any live change, independently verify loopback/security policy, owned state and
unchanged external services before and after. Only PocketHost-owned processes are
controllable. Trusted private-LAN access is a narrowly approved exception under
[ADR-0006](adr/0006-private-lan-access.md), **not** authenticated public administration.

Release requires real browser click/keyboard/accessibility checks for changed screens,
particularly P3 Publish/Rollback; regression snapshots cannot prove the buttons work.
PhotoMap has no approved live Start/health/Stop, orphan cleanup, SQLite migration safety
or whole-instance rollback. Its current PRoot staging is **not** a security sandbox:
do not enable runtime, autostart or UI mutation controls based on source tests alone.
Live PhotoMap testing requires a separate explicit, bounded authorization.

## Accepted evidence versus outstanding gates

- **Accepted** on Samsung at source `a5443070f1c6e41798641aa9c2098a9acc9e17a4`:
  9/9 PhotoMap host negatives, 65/65 root Node tests, 66 Markdown documents,
  Prettier, ESLint and TypeScript; port 8010 closed.
- **Accepted** documentation-only at `3ee728fa6c7d0272b8aa7b1fdfc332a62bf6138d`:
  documentation, Markdownlint, formatting and diff checks.
- **Not yet accepted:** this newer archive-index/refactoring commit and full combined
  G2 at its SHA; P3 real browser Publish/Rollback; PhotoMap live lifecycle,
  process descendant/orphan handling, migration/restore and production release.

The exact evidence and bounded next steps are in the
[canonical handoff](HANDOFF_NEXT_CHAT.md) and
[Samsung QA checkpoint](checkpoints/2026-11-06-pocket-host-samsung-source-and-handoff-final.md).

## Next tooling additions (not installed or accepted by this document)

Prioritize a coverage report with sensible thresholds for host/runtime contracts,
a static unused-code/dependency audit (Knip), and live accessibility/browser tests
when the selected Termux browser driver is proven. Add CSS token/style checks if
actual UI drift appears. First check compatibility on Samsung and avoid parallel
test frameworks, global installs and new automation services.

## Current sprint additions — not release acceptance

- `npm run test:coverage` uses the existing Node coverage machinery; run it on
  Samsung to collect a baseline before enforcing percentage thresholds.
- The admin host overview now validates its complete versioned read-only snapshot
  with installed Zod. Additional APIs require their own schemas and negatives.
- New P3 component tests verify semantic controls and blocked states in jsdom;
  they cannot substitute for physical-browser keyboard and click acceptance.
- PRoot stop completion now checks process-group absence in addition to leader
  identity and port release. Reparented/detached descendants may still escape
  that observation; full orphan recovery remains a **release HOLD**.
- Structured JSONL events and pure recovery planning provide bounded visibility,
  not permission to restart, kill or delete managed processes automatically.

The [current sprint checkpoint](checkpoints/2026-11-07-quality-hardening-sprint.md)
records exact receipts; this newer code must pass same-SHA `check:all`.

## Latest accepted versus pending evidence — 2026-11-07

On Samsung Termux, source `bd5347ff17945c0d04fa9cd66709b02e8ae651f4`
passed `npm run check:all`: 81/81 root tests, 12/12 admin Vitest,
Prettier, Markdownlint, ESLint, TypeScript and Vite build. Built-in Node
coverage also passed, with 79.38% aggregate lines and 44.34% in the disabled
PhotoMap host adapter. This is a verified **older SHA**, not acceptance of
later source refactors. See the [current checkpoint](checkpoints/2026-11-07-main-runtime-host-sprint.md).

The latest source adds more host tests and app-specific adapters; run the full
same-SHA native gate before claiming readiness. Knip remains non-blocking
until its baseline is reviewed. P3 browser interaction and P4 real PRoot
recovery remain independent hardware release holds.
