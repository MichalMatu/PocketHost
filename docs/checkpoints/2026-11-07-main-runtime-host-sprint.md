---
status: in-progress
owner: core
last_reviewed: 2026-11-07
purpose: Evidence-based autonomous main-only runtime hardening and unfinished release gates
---

# PocketHost — main-only process and quality sprint

## Branch and safety contract

All work is committed directly to the current `main`; no new development branches,
force-push, GitHub Actions, Codex or ChatGPT Work. PocketHost commands and builds
run exclusively on the explicitly selected Samsung Termux Local Agent.
The original PhotoMap, IleStoi.pl, Local Agent, other foreign services, public
ingress, autostart and package operations are unchanged. PhotoMap runtime
remains **disabled and unapproved for live Start**.

## Accepted evidence

- **`bd5347ff17945c0d04fa9cd66709b02e8ae651f4`**:
  Samsung receipt `pockethost-sprint1-native-gate-bd5347-20261107-v1`,
  **done/0**. `check:all` passed: 81/81 root Node tests, 12/12 Vitest,
  Prettier, Markdownlint, ESLint, TypeScript, admin lint and Vite build.
  This closes the earlier menu timing regression in that native run. The
  native `test:coverage` command also passed. Port 8010 stayed closed.
- The coverage baseline at this source SHA is **79.38% lines, 82.52% branches,
  82.76% functions**. The disabled PhotoMap host adapter only reached
  **44.34% line coverage**: this is _not_ evidence of working live PRoot.
- The Samsung P3 `owned-site-host.test.mjs` exercises a real isolated
  loopback Node child: Create, Start, GET/HTTP, publish v2, one-step rollback
  and verified Stop. This is native process/HTTP evidence, **not** a real
  browser click/keyboard release gate.

## Current code delivered, awaiting exact-SHA QA

1. Reusable process lifecycle supervisor with explicit ownership,
   bounded startup/health/stop polling, failed admission and uncertain-stop
   errors; no PID-only or process-group kill fallback.
2. Application-neutral runtime registry with unique ID/port registrations
   and no discovery-to-ownership conversion.
3. Generic PRoot argument builder (no shell) with canonical admitted binds;
   PhotoMap provides only a project-specific launch plan and profile.
4. Bounded `/proc/<pid>/task/<pid>/children` collection with exact process
   start ticks for observed descendants, in addition to process-group absence.
   Inaccessible or inconsistent evidence blocks marker cleanup.
5. PhotoMap-specific manifest/profile/workset and launch-plan validation
   moved to `photomap-runtime-plan.ts`; generic canonical file guards
   and lifecycle supervision moved into separate host utilities.
6. Existing Zod now validates P3 owned-site state/logs and PhotoMap P4
   read-only catalog, beyond the previously verified host-snapshot schema.
   Adversarial API payload tests reject forged ownership, nonloopback URLs
   and enabled PhotoMap mutation capabilities.
7. Native coverage command remains dependency-free, and Knip v6.43.0 is
   being evaluated only as an optional, non-mutating diagnostic on Termux.
   No dependency pruning or host package installations were accepted.

## Additional Samsung acceptance and defects — 2026-11-07

- **`main@645c2b2531b72862e9ac7f01f49053df315aaca6`**:
  Samsung task `pockethost-final-qa-current-main-645c2b-20261107-v1`
  completed **done/0**. Full `check:all` PASS, including 16/16
  admin Vitest checks, Node coverage floor, TypeScript, lint, formatting and
  Vite build. Dedicated real local P3 Create/Start/HTTP/Publish/Rollback/Stop
  fixture passed 4/4 tests. Port 8010 stayed closed.
- Knip 6.43.0 and Knip 5.86.0 both fail in Samsung Termux with
  `ERR_DLOPEN_FAILED` on `oxc-resolver` Android ARM64
  (`__emutls_get_address`); this is an **environment/tooling HOLD**, not
  unused-code evidence. Do not prune dependencies or vendor files.
- At **`main@05d435d4f5d71268b0ede3e6e90495c4fc0fa846`**,
  `pockethost-current-main-gates-knip5-20261107-v1` completed FAIL:
  99/99 Node tests and all structural gates PASS, but Markdownlint MD012
  found two duplicated blank lines in `DEVELOPMENT_PLAN.md` and
  `HANDOFF_NEXT_CHAT.md`. No later gates reached. This was addressed
  in the subsequent documentation-only repair.
- A true Chromium read-only render attempt
  `pockethost-chromium-p3-readonly-smoke-20261107-v1` timed out (124).
  No browser interaction PASS; native Chromium 156.0.8078.47 is available.
  The read-only discovery task for ports 8787 and 18787 was still pending
  at the time of this checkpoint.
- The later start-claim patch preserves a recovery hold if PRoot spawn
  identity or health cannot be confirmed. A retained `start.claim`
  reports `unknown`; no automated claim deletion or process adoption.
  This candidate requires a new full native QA receipt.

## Validation receipts still awaited

- Task `pockethost-sprint2-generic-proc-tree-fullqa-20261107-v1`
  targets source `e116c9f004ce56e125c936f5dc0bf0b4b0f36bdb`.
  It requests `check:all`, coverage, native P3 loopback lifecycle and an
  informational Knip baseline in an isolated QA checkout, without PhotoMap
  activation. This is an **intermediate SHA**, not the latest code.
- Later source commits include P3/P4 Zod schemas and the PhotoMap profile
  extraction; require a **new full `check:all` on their exact final SHA**.
- No terminal result means **UNVERIFIED**, never PASS.

## Not done — do not silently close

1. Verify and repair any source, formatting, type, UI-test or lint failures
   at the latest committed `main` HEAD, then record clean QA checkout.
2. Review a native Knip report; do not auto-delete supposedly unused vendor
   screens, pinned dependencies or application entrypoints. Pin a usable
   configuration before promoting it to a gate.
3. Add meaningful host/runtime coverage thresholds only after the native
   baseline excludes disabled hardware operations responsibly.
4. Test actual P3 browser Publish/Rollback, keyboard navigation and accessibility
   plus pre/post evidence that all six foreign services remain unchanged.
   No simulated DOM test is a substitute.
5. PRoot orphans escaping process groups, fork/reparent races, lock recovery,
   failed spawn with unknown descendant identity, scoped error log history
   retention and full source/SQLite/media rollback still need controlled
   hardware safety evidence. Capturing one process tree is not exhaustive.
6. **PhotoMap live activation remains a HOLD** until its copied rootfs,
   disposable workset and complete process lineage/restoration are separately
   authorized and accepted. Never adopt the original live PhotoMap service.

## Next entrypoint

Read [the current handoff](../HANDOFF_NEXT_CHAT.md), then resume directly on
fresh `main` with the exact Samsung Local Agent. First settle source-level QA;
do not unlock features or production services to make tests pass.
