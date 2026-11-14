---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Fast source QA and guarded DEV refresh
---

# One-task FAST FLOW

1. Fresh main, known live SHA, one coherent source commit.
2. One host-command task in verified Samsung Termux using the existing clean QA checkout. Fetch/pin exact target.
3. Execute `node ops/termux/fast-flow.mjs --base=<live-sha> --target=<target-sha> --apply`. It selects changed-source checks, verifies panel owner/foreign services, uses guarded rollback and checks routes.
4. Read **one terminal receipt**. No second QA/deploy task; missing result = HOLD, not retry permission.

Docs-only: targeted Markdown validation, no refresh. UI-only: prefer Vite HMR. Avoid installs, repeated PASS checks, per-commit admin lint or full suites. Privileged/unmapped changes require explicit review. Samsung only, never CI/Mac/sandbox.
