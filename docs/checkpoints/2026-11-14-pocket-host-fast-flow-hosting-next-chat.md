---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Exact-source checkpoint and six-step next-chat plan
---

# PocketHost — checkpoint 2026-11-14

## State

- Repository: `MichalMatu/PocketHost`, main only. Source before this handoff: `da72da38685ee2424b30a43e02ad345aa43031c6`. **Always re-read HEAD.**
- Last confirmed live DEV panel: `f37d0bc`. Recheck its real owner/revision; later source commits do not prove installation.
- Documentation: 137 Markdown files reduced ~93% in `cf859bf`. Native Prettier + Markdownlint PASS on 19 changed `AGENTS.md` files; formatting applied on main through `da72da3`. Final exact-SHA docs task `pockethost-md-final-check-da72da3-20261114-v1` had **no terminal receipt** at handoff; check once, do not duplicate.
- FAST FLOW: `ops/termux/fast-flow.mjs` exists. Last attempted update `d801da7` ended HOLD at `changed-file format`, with **no deployment**. The one-task end-to-end update is not yet qualified.

## Next steps, in order

1. **Close documentation:** inspect the pending exact-SHA result; fix only confirmed Markdownlint/Prettier failures. Preserve the tiny Markdown and Git history. Docs-only means no panel restart.
2. **Close FAST FLOW:** one Local Agent task covering focused impacted QA → verified owner/protected-service preflight → guarded PocketHost-only update/rollback → HTTP/actual source check → one terminal report. No duplicated QA/deploy tasks or repeated PASS.
3. **Node.js Hosting + GitHub:** disposable user-owned project; import → reviewed dependencies/build → owned start/readiness/logs → update and rollback. Preserve independent H2 static hosting.
4. **Hosting integrations:** Cloudflare/domains/HTTPS, SSH, per-site HTTP traffic analytics, files/terminal and scoped backups/restores. External services remain read-only until separately authorized.
5. **Termux installer:** versioned PocketHost bundle and repeatable one-command install in official Termux; no mandatory Companion/Shizuku.
6. **Physical acceptance:** Samsung browser, actual runtime failures/recovery, revisions, isolation and rollback; distinguish focused DEV PASS from full G2/G3.

## Execution and safety

Read [root AGENTS](../../AGENTS.md), [start](../START_HERE.md), [FAST FLOW](../DEV_ITERATION.md) and only relevant source. GitHub Connector + verified **Samsung Termux Local Agent**, no Mac/Codex/Work/Actions. Main-only commits, targeted checks and exact-source receipts; no speculative PASS.

Never interfere with IleStoi, PhotoMap, Local Agent, Cloudflare, SSH, Mosquitto, existing H2 sites or their data. A discovered process is not owned. DEV LAN panel has no authentication/TLS and must not be exposed publicly.

History before Markdown slimming: `git show d801da7:<path>`.
