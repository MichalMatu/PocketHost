---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Current PocketHost source, hardware and release acceptance contract
---

# Quality Gates

## Execution and evidence

PocketHost commands run only on the exactly addressed Samsung Termux Local Agent.
GitHub Connector moves source and private task/result data, not test execution.
No GitHub Actions, Codex, ChatGPT Work or Mac/Linux fallback. A gate is PASS
only with a terminal receipt, exact tested source SHA, exit code and scope.
Do not carry a native result to a later code SHA or infer deployment from code.

## G0 — foundation and safety

`npm run check:foundation` checks the manifest, document links/frontmatter,
module boundaries and Node negative tests. Discovery is read-only; only
explicitly registered PocketHost-owned processes may receive lifecycle calls.
Ownership cannot be inferred from names, ports or discovered processes.

## G1 — source quality

`npm run check` includes G0, Markdownlint, Prettier, ESLint and TypeScript.
Use pinned lockfiles and qualified device tools. Do not weaken gates to
hide platform-specific failures.

## G2 — full source and UI tests

`npm run check:all` runs G1, the Node coverage floor (75% lines,
78% branches, 78% functions), admin lint/build and Vitest interactions.
It covers source contracts and deterministic negative cases, **not**
actual browser clicks or live PRoot orphan cleanup. Record exact source SHA.

## G3 — physical browser, host and release

Before and after any owned runtime mutation, verify the target ownership,
loopback binding, process identity and all six protected foreign services.
Release of changed P3 UI requires actual browser Publish/Rollback,
keyboard/ARIA/version-selection and failure-state evidence. PhotoMap requires
separately approved controlled Start/health/Stop and whole-instance
source/SQLite/media restore on disposable data. A PRoot child snapshot or
process-group check alone is not an exhaustive orphan proof.
No public administration, autostart or package mutations by default.

## Accepted 2026-11-07 baseline

At `main@bc5e5539ca4656e59077335b71c0875f967ea859`,
Samsung receipt `pockethost-claim-final-clean-native-gate-bc5e55-20261107-v1`
returned `done/0`: **101/101 Node**, **16/16 admin Vitest**, all
`check:all` gates PASS; QA checkout clean and PhotoMap port 8010 closed.
Coverage was **80.34% lines, 84.30% branches, 79.88% functions**.

Separate Samsung receipt
`pockethost-p3-owned-live-reversible-api-acceptance-20261107-v1`
returned `done/0`: real owned loopback P3 Publish → Rollback → Stop →
Start with HTTP verification, leaving all six external services unchanged.
This closes the prior P3 native/API lifecycle check, **not G3 browser UI**.

## Outstanding release holds

- Chromium read-only render timed out (exit 124); real P3 browser and
  keyboard/accessibility acceptance is **not passed**.
- PhotoMap live runtime, orphan/reparented-descendant recovery and complete
  restoration are **not accepted**; continue to deny Start.
- Knip v5/v6 fail in Termux on native `oxc-resolver` loading.
  Knip remains informational and cannot justify dependency pruning.
- Documentation-only commits after the accepted source baseline require
  their own documentation checks; they do not retroactively change that
  accepted application-source result.

See the [current handoff](HANDOFF_NEXT_CHAT.md) and
[final Samsung checkpoint](checkpoints/2026-11-07-final-native-qa-handoff.md).
