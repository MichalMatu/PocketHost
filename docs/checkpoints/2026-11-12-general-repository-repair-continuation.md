---
status: source-repaired-device-gates-open
owner: core
last_reviewed: 2026-11-12
purpose: Repository-wide triage, real source repairs, evidence limits and next-session continuation
---

# PocketHost repository repair — source checkpoint and continuation

## Preflight and change horizon

- Starting `main`: `862e99aa9c6e2e10f6043cc9dbce4749f950ab2d`.
  Latest source repair before documentation: `3877a5f12645b1b676902f4aa0c4c65fe1c489fa`.
  Verify fresh HEAD at every resumption; a later documentation commit changes it.
- Repository inspection: 615 tracked blobs at baseline, including 277
  admin source files, 44 host-adapter files, 13 shared files, 14 native
  files, 85 test files, and 103 documentation files. This inventory is
  **not** a file-by-file proof of correctness.
- Git history began 2026-11-05; 1035 commits were present when sampled.
  About 1026 are within the last seven days. The 30- and 90-day
  windows contain the same short-lived repository history.
  Changes predominantly cover H2 static Hosting, Termux/Android/Shizuku,
  M0/M1 identity isolation, M2/M3 Node candidates, Dashboard/System UX,
  safety guards, test revisions and DEV tooling.
- The `feature/h3-termux-control-center-20261107` branch was behind
  `main` by 496 commits, with zero commits ahead. Nothing from that
  branch needed merging; do not delete it without a separate decision.
- Examined root/scoped instructions, architecture, roadmap, active
  handoff, quality/FAST FLOW, recent checkpoints, representative host,
  UI, test and tooling files, and last Samsung receipts.
  Avoid replaying the 2026-11-11 G2 or historical audits just to
  reconstruct state.

## Proven findings and source repairs

1. **Package view regression:** Samsung test of `862e99a` failed:
   switching back from the apt catalog kept the catalog query, so the
   installed inventory remained hidden. Commit `1a7a8a9` resets the
   view-specific search and stale selection on the return to Installed.
   Existing interaction test exercises the failure.
2. **Protected service gap:** `TermuxServiceAdmin` protected foreign
   units but omitted the existing PocketHost DEV panel and watchdog.
   UI guards alone were insufficient. Commit `ca8eb4e` adds both
   protected unit names in the host adapter and negative checks for
   registration, lifecycle, enable/disable and exact registration.
   This does not authorize service restarts.
3. **False package refresh certainty:** `PackageManager` announced
   an inventory refresh before its asynchronous GET completed.
   Commit `3877a5f` reports a refresh **request**, and adds a
   regression for completed mutation followed by failed inventory
   reread; the prior installed list is retained with an error.

No new product features, dependencies, runtime service adoption,
external process operations, package mutations or deployment occurred.

## Native evidence: precise scope

- **Historical exact-SHA G2:** Samsung `bba2d625`, 282 Node tests and
  111 admin UI tests passed (2026-11-11). This never certifies the
  newer source or Android physical G3.
- **Recent Samsung failures:** On `3aea43e`, 20/20 scoped UI tests and
  admin typecheck passed, but docs failed the former >9 KiB
  `AGENTS.md` budget. Its current abbreviated file is under that
  limit. On `862e99a`, the package interaction suite failed as above.
- **Current source repair verification:** **OPEN**. A focused
  Samsung Local Agent task for `1a7a8a9` was published, but no
  terminal receipt had arrived by checkpoint authoring. Since
  `main` moved, it must not be treated as current-source PASS.
- No post-repair G1/G2, E2E Chromium, clean install, external
  dependency audit, physical runtime/recovery test or live panel
  update has been confirmed. The Local Agent connection is known
  from older receipts, not from a live new terminal result.
  Linux/Mac execution is prohibited by PocketHost AGENTS.md.

## Open risks and next deterministic steps

- **P0:** Private-LAN admin includes an unauthenticated owner shell;
  never publish it on WAN. Do not broaden service/network privileges.
- **P1:** Obtain a terminal receipt on the current source for
  `tests/quality/h3-runit-service.test.mjs`,
  `apps/admin/tests/termux-admin.interaction.test.tsx`, root
  formatting/types/docs, and the user-requested one-time
  milestone `npm run check:all`. On failure, repair the precise
  regression and rerun only its dependent check before G2 closeout.
- **P1:** Confirm actual Samsung source checkout, clean worktree,
  command toolchain, verified panel source vs GitHub and protected
  services before any DEV sync. Source commits did not deploy.
- **P1:** Keep M2/M3 disposable Node Hosting G3, independent backup
  recovery, Android Shizuku permission failures and full nine-route
  browser/mobile acceptance OPEN.
- **P2:** Continue code-quality review of large Vite adapters and
  remaining host modules in bounded, path-specific slices. Upstream
  ShadcnStore routes/assets are intentionally preserved, not dead
  code eligible for wholesale deletion.

**Handoff:** Start from fresh `main` and this checkpoint. Read the
already published Local Agent result once; do not duplicate stale
tasks or infer PASS. Run verified Samsung scoped gates and one
milestone G2 only when intake and exact checkout are confirmed.
Document terminal results, exit codes, SHA, test selection,
skipped checks, and any device deployment in this archive.
If intake remains unavailable, leave QA and sync explicitly HOLD
rather than running PocketHost in another environment.
