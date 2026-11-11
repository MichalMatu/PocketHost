---
status: active
owner: ui
last_reviewed: 2026-11-09
purpose: Small, safe and cache-aware Samsung Local Agent development loop
---

# PocketHost DEV — Fast Flow

## NON-NEGOTIABLE: SHORT, CHANGE-FOCUSED SPRINTS

**Default: implement -> run only affected tests -> sync/HMR -> owner review.
No per-commit ESLint, complete UI suite, full G2, coverage or build.**

- A changed interaction test runs **that file only**. A changed Node test
  runs **that file only**. Do not add a structure gate for a test-only edit.
- For a UI behavior change, run the directly related Vitest file and
  incremental TypeScript only when the changed component warrants it.
- For copy/CSS, use HMR and owner visual acceptance; for docs-only edits,
  no source tests and no panel restart.
- For a failing focused test, fix the actual regression, then rerun
  that test. **Do not replay previously passed checks** to chase a new SHA.
- Admin ESLint is periodic and opt-in. It is not a blocker in the
  ordinary fast loop; full release G2 remains a separate milestone gate.
- Avoid preflight repetition, duplicate Local Agent tasks and continuous
  polling. Do not let documentation-only commits invalidate an
  exact-SHA DEV refresh already in progress.
- A requested PocketHost-only reload uses the existing guarded owner
  refresh and a small route smoke, **not** another lengthy G2.
  Keep foreign services untouched. Missing evidence stays HOLD/OPEN,
  never reported as PASS.


## One normal iteration

**Fresh main -> small coherent edit -> commit -> focused Samsung
Local Agent check -> existing Vite HMR -> owner feedback.**
Only the positively verified PocketHost DEV panel can be refreshed
or restarted under its existing owner-approved runit policy.
Do not create second preview servers, restart a service for CSS,
reinstall dependencies per task or run full G2/G3 after each edit.

All development commands below run **exclusively on the verified
Samsung Termux through Local Agent**, not on Mac, ChatGPT sandbox,
GitHub Actions, Codex or Work. Reuse the exact checkout/host
identity established during the session; recheck when it changes.

## Command selection

| Intent                     | Command                                                    |
| -------------------------- | ---------------------------------------------------------- |
| Preview affected gates     | npm run dev:changed -- --base=<last-verified-sha>          |
| Execute affected gates     | npm run dev:changed -- --base=<last-verified-sha> --run    |
| Route preservation only    | npm run dev:quick                                          |
| One interaction file       | npm run dev:ui -- tests/termux-center.interaction.test.tsx |
| Existing Vite DEV panel    | npm run dev:panel                                          |
| One GitHub UI sync         | npm run dev:sync:once                                      |
| Manually opt-in UI watcher | npm run dev:sync                                           |
| Validate watcher policy    | npm run dev:sync:test                                      |
| Milestone full gate        | npm run dev:full                                           |
| Periodic admin ESLint     | npm run admin:lint (manual, about weekly or milestone)     |

The change selector reads an exact clean Git revision range and
direct/transitive static imports to select affected Node and Vitest
tests. Its local dependency map is cached under ignored .tmp/,
keyed by HEAD. The default **previews only**; --run executes checks
in the same checked-out environment. Routine admin ESLint is
**deferred**, not automatic; use `--admin-lint` for one intentional
periodic check of changed UI files. Never halt ordinary UI iterations
only to fix noncritical admin lint issues. A release G2 still requires
admin lint, but it must not run on each commit. Unmapped code, deleted files,
dependency/config and high-risk service changes require manual
review; they are never implicitly accepted. Dynamic or indirect
runtime wiring may need an additional focused test.

## Cache and process budget

- Preserve existing node_modules and npm cache. Run npm ci only when
  the verified lockfile changed or required packages are missing;
  no global pkg upgrade merely to test a source edit.
- Root TypeScript incremental data stays in ignored
  .tmp/root-typecheck.tsbuildinfo; admin TypeScript build info
  remains in apps/admin/node_modules/.tmp/.
- Reuse Vite HMR for TSX/CSS changes. Do not restart the panel for
  docs; no repeated full build/coverage for a simple route.
- Use one bounded Local Agent task with concise exit statuses,
  redacted failure tails and exact SHA. Before another task, inspect
  pending/terminal results. Reuse prior PASS only for the unchanged
  tested scope and revision; no infinite retries or duplicate runs.
- No mandatory pre-commit/post-commit hooks, auto-installs,
  repo-wide formatter on every file, background test daemons or
  extra physical smoke just to advance source edits.

## UI watcher — limited and opt-in

One manually started npm run dev:sync watcher polls GitHub main
about every eight seconds. It updates **only a clean, verified
PocketHost checkout** with a matching owned panel PID/start ticks
and cwd. The allowlist is apps/admin/src/**,
apps/admin/tests/**, docs/** and root text docs. Changes to
vite.config.ts, package manifests, backend, scripts, network,
service controls or Agent files yield MANUAL_REVIEW; the watcher
must not silently deploy them.

CURRENT means no update; SYNCED reports an exact SHA;
MANUAL_REVIEW requires human evaluation; HOLD is not a deployment.
The watcher never runs tests, installs packages, kills/restarts
services or creates WAN listeners. A separate explicit
PocketHost-only restart is allowed when needed, after checking
ownership and preserving a rollback SHA.

## Safety and broader gates

Preserve IleStoi, PhotoMap, Local Agent, SSH, Cloudflare, hosted
sites, unrelated processes and data. No PID/name/port-only
ownership inference, no silent service changes, no host-wide
cleanup or other applications' autostart. H3.4 owner Termux
capabilities and Shizuku Advanced Shell are explicit UI actions
within actual OS privileges; they are not automatic QA hooks.

Run larger native checks for host filesystem/process interfaces,
persistent data, package actions, network exposure, authorization
or major milestone closure. Separate current-source G1/G2 from
physical G3; see [quality gates](QUALITY_GATES.md) and
[Local Agent transport](LOCAL_AGENT_TERMUX.md).
