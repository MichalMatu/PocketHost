---
status: source-committed-native-qa-open
owner: core
last_reviewed: 2026-11-09
purpose: Record recovered Samsung reports, exact Prettier patch application, M1 ownership diagnostics and outstanding source gates
---

# PocketHost — M0 canonical style and M1 ownership diagnostics

## Exact source and scope

PocketHost main advanced through `22245f13` (new source-only M1 ownership diagnostic and negative tests) and `9ca92cf0` (the remaining four Prettier diffs reported by Samsung, applied exactly through GitHub Connector). This documentation commit advances main again; always verify its actual HEAD.

The new `src/modules/host/hosting-service-ownership.ts` reuses the pure M1 registry and existing `attestsManagedProcess` guard. It checks a revision, registered and observed runit name and canonical target, protected state, explicitly matching owner marker, and PID/start ticks/executable/cwd/argv hash. It returns only `consistent` or `unverified` for diagnostics. Even `consistent` is not permission to start, signal, migrate or adopt a process: the live host adapter must independently attest source provenance and real process identity at use time. There is no UI or execution integration.

## Recovered native Samsung receipts

- `pockethost-m1-registry-store-focused-s22-01db6f2-20261109-v1`: 3/3 store tests, root lint and TypeScript PASS on historical `01db6f2`; full formatting FAIL on 11 then-current files.
- `pockethost-m1-registry-boundary-focused-s22-2b5d300f-20261109-v1`: 7/7 M1 tests, boundaries, structure, lint, TypeScript and Markdownlint PASS on `2b5d300f`; changed-file formatting FAIL on three then-current files.
- `pockethost-m0-remaining-gates-s22-5bccbe2b-20261109-v1`: Markdownlint, lint, TypeScript, coverage, admin lint and build PASS on `5bccbe2`; formatting and full UI FAIL. This is an old SHA.
- `pockethost-m0-prettier-diff-corrected-9b17bf6-20261109-v2`: read-only Samsung diff scan completed; its 13 identified changes were not all simultaneously applicable to later source.
- `pockethost-m0-prettier-remaining-0f5291d7-20261109-v2`: native read-only PASS, exactly four remaining formatting diffs for `0f5291d7`. All four were applied in `9ca92cf0` with exact context checking, no automatic rewrite.

`pockethost-m0-ui-unretested-15files-0f5291d7-20261109-v1` was rejected before execution (budget exhaustion, exit 125); corrected v2 was published. This is not a UI test failure.

## Native tasks still requiring terminal receipts

- `pockethost-m1-targeted-uid-umask-ts-9fb7db93-20261109-v2`: previously failing negative permission fixture and TypeScript at exact `9fb7db9`.
- `pockethost-m0-ui-unretested-15files-0f5291d7-20261109-v2`: 15 UI files not covered by the earlier 19/19 focused PASS.
- `pockethost-m1-ownership-contract-focused-22245f13-20261109-v1`: new read-only M1 ownership diagnostics, boundaries, TypeScript, lint and changed-file format.

Each task uses an isolated clean Samsung QA checkout. A published task is not a PASS, and a historical pass is not exact-current-SHA certification.

## Source-only rollback planning extension

The additional `4fa08631` source-only v1 rollback planner validates stored envelope ownership, version and revision, requires independently trusted SHA-256 fingerprints for both the current and earlier snapshots, and returns a bounded next-revision declaration plan. It never writes or migrates live registry files. Native focused task `pockethost-m1-rollback-planner-focused-4fa08631-20261109-v1` is published; its terminal result is not yet observed.

## Later Samsung terminal evidence

- `pockethost-m0-ui-unretested-15files-0f5291d7-20261109-v2`: `done/0`, **55/55 UI** in 14 files PASS at `0f5291d7`.
- `pockethost-m1-targeted-uid-umask-ts-9fb7db93-20261109-v2`: `done/0`, targeted permission negative and TypeScript PASS at `9fb7db9`.
- `pockethost-m1-ownership-contract-focused-22245f13-20261109-v1`: 3/3 focused tests and boundaries/types/lint PASS; Prettier FAIL, overall `failed/1`.
- `pockethost-m1-rollback-planner-focused-4fa08631-20261109-v1`: 3/3 focused tests and boundaries/types/lint PASS; Prettier FAIL, overall `failed/1`.
- `pockethost-m0-m1-final-source-format-docs-93cec35e-20261109-v1`: structure PASS; missing checkpoint links, 3 MD012 extra blank lines and 5 Prettier warnings. Later source updates address these findings, pending exact-source confirmation.

No current-SHA full source G2 or physical G3 is inferred from historical receipts.

## Remaining gates and safe next actions

- **G1:** Four known Prettier warnings patched; recheck whole source including newly added files and this documentation on final SHA.
- **G2:** Await 15 remaining UI files; only address identified failures. A complete exact-final-source matrix is still OPEN.
- **M1:** Current private v1 persistence has no approved live version migration or rollback. New ownership inspector is diagnostic source only; native acceptance and independently verified host integration remain OPEN.
- **G3:** No current-source physical owned-site create/publish/reboot acceptance. No active panel, runit, IleStoi, PhotoMap, Local Agent, Cloudflare, SSH or existing registry was modified.

Next: consume terminal receipts, apply only confirmed patches, finish focused native QA, and keep full G1/G2/M1/G3 gates OPEN until actual final-source evidence exists. Work on main with non-force expected-HEAD updates; no GitHub Actions, Codex, Work or non-Samsung test execution.
