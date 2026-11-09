---
status: targeted-native-ui-pass-m1-repair-pending
owner: core
last_reviewed: 2026-11-09
purpose: Preserve real native test outcomes, targeted fixes and pending quality evidence after M0/M1 resumption
---

# PocketHost — M0 UI PASS, M1 targeted native repair

## Verified native evidence

The Samsung Termux Local Agent task `pockethost-m0-m1-focused-native-10731bca-20261109-v1` ended **failed/1** on exact source `10731bca1f46bc16d21f902176f01fcfa871e5ba`:

- **PASS:** structural gate, module boundaries, root ESLint and **19/19 focused UI tests** across dashboard, Termux admin and Hosting/site fleet.
- **M1 Node 8/9:** one negative permission test failed. On Samsung, an enforced `umask` can override the requested non-private creation mode, so the fixture did not actually create an unsafe file.
- **TypeScript FAIL:** three `TS2722` errors because `process.getuid` is optional in the Node type contract.
- **Formatting OPEN:** the touched M1 store and test had Prettier warnings. The earlier full source format scan on `10731bca` identified 12 files requiring canonical formatting, not a 12-test failure.
- Isolated source and correct SHA were verified; no active service, website, Local Agent, Cloudflare configuration or real registry was touched.

The earlier `5bccbe2` full M0 QA passed Markdownlint, root ESLint, TypeScript, coverage, admin lint and build; formatting and four old UI tests failed. The three affected UI files have now passed **19/19 focused native tests** on `10731bca`. This does **not** certify the unrun complete UI matrix on the final source.

## Committed repair

Commit `9fb7db9310316633e068a03248677b9c413fc473`:

1. M1 file owner checks use an explicit `currentUid()` guard, rejecting environments with no host UID API, rather than invoking an optional method unsafely.
2. The non-private file negative fixture explicitly applies `chmodSync(..., 0o644)` after creation, making it deterministic even with Termux `umask 077`.

The only missing native regressions from that receipt were queued as `pockethost-m1-targeted-uid-umask-ts-9fb7db93-20261109-v1`: the previously failing test and TypeScript, without repeating the previously passing UI matrix. Terminal evidence was **not observed at this checkpoint**.

## Canonical format and remaining queue

The initial read-only formatting task `pockethost-m0-format-diff-native-10731bca-20261109-v1` ended failed because its Python launcher passed both `stdin` and `input`; its partial scan still identified 12 files. The corrected read-only task `pockethost-m0-prettier-diff-corrected-9b17bf6-20261109-v2` is published against exact `9b17bf6`, with no terminal result yet. Apply its actual diffs through GitHub Connector and then qualify the final code; do not manufacture Prettier PASS or blindly rewrite files.

Older `5bccbe2b` M0 and `01db6f2`/`2b5d300f` M1 task requests remain without observed terminal receipts. Do not reissue them or treat missing receipts as PASS.

## Decision and next gates

- **M0 focused UI:** PASS 19/19 at `10731bca`; **full final-source G2 remains OPEN**.
- **M1 private registry:** 8/9 at `10731bca`; targeted permissions/type repair committed at `9fb7db9`, **final acceptance OPEN** pending actual native receipt.
- **G1 full formatting:** OPEN pending canonical patch and recheck on final SHA.
- **M1 version migrations:** fail-closed unknown-version handling exists, but a real versioned migration mechanism and rollback are **not implemented or approved**. No existing registry was migrated.
- **M1 positive process/service ownership:** OPEN; private file UID checks do not authorize runtime control.
- **G3 phone/release:** OPEN; no new deployment, physical reboot or owned-site runtime mutation was performed.

Continue only missing diagnostics and regressions on the verified isolated Samsung QA checkout. Keep all active external services untouched; use `main` and non-force expected-HEAD commits only.
