---
status: accepted
owner: core
last_reviewed: 2026-11-23
purpose: Final G0–G2 exact-source qualification on Samsung A8
---

# Final G2 qualification — 23 November 2026

The first full A8 gate at `3b74c6b` **failed**: 13 UI assertions, Node line coverage below threshold, admin lint and formatting, plus test-file size budgets. The subsequent source fixes, formatting, test splits and React hook corrections were qualified at the final source `d2bacd081ad0879d49a08e3c7fd97789185ad6e4`.

Two immutable A8 Local Agent task results completed terminal `done`, exit 0, inner `QA_PASS`:

- `pockethost-a8-g2-final-core-d2bacd0-20261123-v1` — structure, docs, boundaries, code budgets, Markdown, full Prettier, root/admin ESLint, root/admin TypeScript, Node coverage gate and Vite build all PASS. Node: **469 PASS / 1 SKIP** out of 470; coverage **76.11% lines, 81.72% branches and 80.50% functions**. Two non-blocking admin lint warnings.
- `pockethost-a8-g2-final-allui-d2bacd0-20261123-v1` — all **77 UI test files**, in 11 bounded batches, **486/486 assertions PASS**.

One Node hardlink denial scenario was skipped because the Android filesystem could not create the hardlink fixture; no unsupported branch acceptance is implied. All 11 UI failures remaining at `8e9fb96` were repaired; a separate 41/41 focused QA receipt on `d2bacd0` also passed.

**Device boundary:** G2 is a source qualification. These tasks did not deploy `d2bacd0`. The last separately verified DEV release was `349087d` and remained unchanged by QA. Full-device reboot/autostart, off-device disaster restore, public ingress and untrusted-code isolation are not G2 claims.

For full earlier failure diagnostics and removed historical checkpoints, see the [pre-cleanup version of this document](https://github.com/MichalMatu/PocketHost/tree/d2bacd081ad0879d49a08e3c7fd97789185ad6e4/docs/checkpoints/2026-11-23-g2-full-qualification.md).
