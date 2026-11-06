---
status: in-progress
owner: core
last_reviewed: 2026-11-07
purpose: Keep exact evidence and remaining quality hardening work for a bounded sprint
---

# PocketHost quality hardening — 2026-11-07

## Source and branch baseline

- Development policy: commit directly to fresh `main` unless the owner explicitly directs otherwise; no new branches, force-push, Codex, Work or GitHub Actions.
- Ten old PocketHost branches were verified as ancestors and deleted. Final branch inventory was exactly `main`.
- Historical sprint `eefd870` was fast-forwarded to `main` with 188 commits. This **did not** constitute a release.
- Subsequent source includes `a56e94` (checkpoint index structure fix), `45791ff` (generic managed runtime), and `634aa3f` (process identity guards).
- PhotoMap TEST is **disabled and unapproved for activation**. Original PhotoMap, IleStoi, runit, Local Agent and all other foreign services were not to be changed.

## Completed source work

1. Consolidated active documentation and moved the 19 historical checkpoints behind their own archive index; preserved original evidence.
2. Added full root/admin `npm run check:all` gate.
3. Fixed the structure gate to accept `docs/checkpoints/README.md` while rejecting malformed checkpoint filenames; added regression tests.
4. Extracted `ManagedRuntimeSnapshot`, `ManagedRuntimePort` and pure generic lifecycle policy, so PhotoMap supplies identity/port/release as an adapter instead of being the universal runtime.
5. Added pure process identity guard: PID, start ticks, executable, cwd and argv digest must agree; added an explicit evidence requirement for descendant-free stop.
6. Added seven deterministic generic runtime and process-guard negative/positive tests. These **do not** amount to PRoot hardware lifecycle acceptance.
7. Applied owner-directed `main`-only policy across root instructions, contributing guidance and operational docs.

8. Added a fail-closed PRoot process-group observation to the stop decision. Leader PID exit and port release alone do not clear an owned marker. Separate process groups and reparented children still require hardware acceptance.
9. Added `test:coverage` using Node's built-in coverage (no new dependencies).
10. Added Zod response validation for the six-service read-only host snapshot and three API contract tests, using the admin's already installed Zod. Other API endpoints remain pending.
11. Added three rendered UI checks for P3 disabled/unknown controls, target-version semantics and rollback availability. These do not replace a real browser audit.
12. Added bounded JSONL runtime events, an event-history reader and a dry-run-only recovery decision; there is no automatic recovery or managed PhotoMap activation.

## Exact native QA evidence (Samsung Termux)

- `eefd870` task `pockethost-main-consolidation-checkall-20261107-v1`: **FAIL** at structure gate: archive `README.md` treated as invalid checkpoint; fixed in `a56e94`.
- `a56e94` task `pockethost-main-native-checkall-after-structure-fix-20261107-v1`: **68/68 Node PASS**, then Markdownlint MD059 on a non-descriptive link; fixed in follow-up source.
- `634aa3f` task `pockethost-main-generic-runtime-process-gate-20261107-v1`: **4/4 generic runtime PASS**, **3/3 process evidence PASS**, **75/75 root Node PASS**, **Markdownlint PASS**. `check:all` returned FAIL at Prettier: `README.md`, `docs/HANDOFF_NEXT_CHAT.md`, `scripts/quality/check-docs.mjs`, `src/shared/photomap-runtime.ts`. ESLint, TypeScript, admin build and Vitest were **not reached** in that run.
- Task `pockethost-sprint-prettier-diff-gates-20261107-v1` completed **done/0** after formatting four files **inside an isolated QA checkout at source `634aa3f`**: 75/75 Node tests, Markdownlint, Prettier, ESLint, TypeScript, admin lint/build and 6/6 Vitest PASS; checkout restored clean. This proves an intermediate formatted candidate, **not** the current committed `main`.

The current refactored `main` (new process-group, API and diagnostics changes) still requires a new exact-SHA native `check:all` and independent browser/device acceptance. An earlier formatted checkout PASS is not transferable.

## Open work — strictly ordered

1. **Same-SHA gate:** run `check:all` plus `test:coverage` on the final committed `main` SHA; fix all lint/format/type/build/Vitest issues and record unchanged port 8010.
2. **Host process safety:** negative fixtures for failed PRoot spawn, PID reuse, timeout, port collision, stale start claims, surviving descendants and process group confusion; do not infer descendant death from leader exit. A reliable cleanup and orphan recovery strategy is still unimplemented.
3. **Decouple PhotoMap host:** split manifest/profile validation, release storage, launch-plan construction, process supervision and log/reporting behind app-neutral typed ports; keep a PhotoMap-specific adapter and never copy its paths into the core. Do this in independently tested increments.
4. **Quality tooling:** collect and review the new Node coverage baseline, then calibrate host/runtime thresholds; evaluate Knip compatibility without installing unreviewed packages or deleting vendor files. Extend Zod contracts beyond the host-snapshot endpoint.
5. **Accessibility:** qualify newly added component checks, then run a real-device browser and keyboard/ARIA audit for P3 Publish/Rollback and version selection.
6. **Diagnostics:** qualify the new JSONL/error-history and recovery dry-run code; then add retention/error-category metrics and a separately approved device recovery procedure. Automated recovery remains prohibited.
7. **Separate release holds:** P3 actual browser command interactions, affected external service readback; P4 on-device safe process-tree identity, test-only controlled Start/health/Stop, SQLite/media restore. Never activate P4 without a separate explicit owner authorization.

## Safe continuation rule

Work only on fresh `main` via GitHub Connector and the exact Samsung Termux Local Agent.
Keep a clean isolated QA checkout, always check its origin and source SHA, never install
or upgrade host packages merely for tests, and do not touch externally owned services.
Update this checkpoint at acceptance boundaries and keep
[the handoff](../HANDOFF_NEXT_CHAT.md) concise. Unfinished source tests are a HOLD,
not a reason to bypass gates or enable PhotoMap.
