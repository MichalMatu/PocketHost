---
status: blocked
owner: core
last_reviewed: 2026-11-23
purpose: Terminal full G2 A8 qualification and bounded fixture repair evidence
---

# PocketHost — full G2 gate run, 23 November 2026

## Exact source, host and receipts

- Host: approved Samsung A8 Termux Local Agent only. QA checkout isolated from deployed DEV. No Android reboot, service modification, public exposure, customer data mutation or new deploy.
- Last independently verified live DEV: `349087d2981c7fc3d8b9feba12d8fc335956a08b`; the panel was verified HTTP 200 before the full G2 task. Documentation/tests-only new commits are **not** a deployment.
- Full G2 was executed on exact `3b74c6b8ba918156d4f9956dfdcac5a64f9e5f32` with A8 task `pockethost-a8-g2-final-3b74c6b-20261123-v1`, terminal outer **failed**, inner **QA_FAIL**. The earlier two `c093828` baseline tasks failed due to missing docs, an outdated Node fixture, hardlink restrictions and Termux npm wrapper incompatibility; they were not silently replayed. Final G2 used pinned direct Node CLIs.
- Structure, docs, boundaries and Markdown lint: **PASS**. Root and admin TypeScript: **PASS**. Admin Vite build: **PASS**. The final build is not evidence of deployment.
- Code-budget check **FAIL**: `apps/admin/tests/node-projects.interaction.test.tsx` 73,095 bytes above 70,274-byte pinned legacy budget; `apps/admin/tests/site-fleet.interaction.test.tsx` 67,297 bytes above 32,768-byte limit and 1,319 lines above 1,200.
- Full Prettier **FAIL**: 61 files. Changed-file formatter also failed for the unformatted new Node data test at the executed SHA; corrected later.
- Root ESLint **FAIL**: one intentional SSH control-character validation regex, subsequently documented with a scoped rule explanation. Admin ESLint **FAIL**: 47 errors and 4 warnings, including actual React Hooks issues in production components and unused test fixture parameters; no lint rules were broadly disabled.
- Node full coverage/test gate **FAIL**: measured 73.41% lines (required 75%), 80.78% branches (required 78%) and 78.99% functions (required 78%). Also one stale single-header assertion failed, corrected and retested after this broad run.
- Full UI: 70 test files in 10 bounded Vitest batches; **473 passed, 13 failed** of 486 assertions. Batches 03/04/05/09 fully passed. Failures were across Android action, control plane, Cloudflare, Local Agent page, Phone Settings, remote shell, service details, Shizuku diagnostics and Static HTML starter. This is **NOT G2 PASS**.

## Repairs following the full gate

- `3b74c6b`: doc metadata/index, stale upsell fixture, portable hardlink negative test.
- `ef2f6f5`: single-header count fixture and intentional SSH control-byte regex lint explanation.
- `a67d9a4`: update seven UI mock/mount/selectors and Prettier-format the Node data test.
- Focused A8 receipt `pockethost-a8-g2-fixture-regression-a67d9a4-20261123-v2`, terminal outer failed, inner QA_FAIL: header Node tests **5/5 PASS**; data-scope Node tests **5 PASS + 1 SKIP** (Android filesystem refused creating a hardlink, so the rejection branch is *not* certified on this host); SSH scoped ESLint **PASS**; changed Node formatting **PASS**; focused UI **19/21 PASS**, two Phone Settings assertions still FAIL. No full G2 rerun at `a67d9a4`.
- The earlier task `pockethost-a8-g2-fixture-regression-a67d9a4-20261123-v1` failed before any tests due to a Python runner keyword error; it was corrected with a distinct v2 ID.

## Unresolved qualification and safe next conditions

G2 remains **OPEN / FAIL**. Do not claim 100% regressions, full line coverage, or universal formatting. Fix the residual UI mocks and any confirmed behavior defects; repair the 47 admin lint errors without hiding React Hooks violations; reduce oversized test files; format legacy files without altering application behavior; add meaningful Node tests to lift line coverage above threshold. Only a later terminal exact-SHA full-scope PASS can certify G2. Preserve current A8 DEV and protected services until such acceptance; no speculative deployment or G3 reboot.

These receipts are available in the fixed host Local Agent task-results directory in `MichalMatu/local-agent:agent-control`, with IDs exactly as written above. G3 physical reboot, independent browser ZIP upload, mutable data recovery and public cutover remain outside G2 and open.
