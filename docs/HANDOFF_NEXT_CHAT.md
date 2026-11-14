---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Minimal next-chat entry and PocketHost sprint priorities
---

# PocketHost — next chat

**First action:** read fresh `main` HEAD, [root AGENTS](../AGENTS.md) and actual live Samsung panel ownership/revision evidence. Never treat a source commit as deployed. Last confirmed live panel in historical checkpoint: `f37d0bc` (must revalidate). The old FAST FLOW attempt at `d801da7` was HOLD with no deployment.

**Default:** **code → deploy → verify** in one verified Samsung Local Agent task, using [FAST FLOW](DEV_ITERATION.md). **No tests, formatting, lint, typecheck, route smoke or documentation checks until the owner explicitly says it is time for tests.** Do not queue duplicate jobs or retry missing receipts. Previous documentation task `pockethost-md-final-check-da72da3-20261114-v1` had no confirmed receipt; do not re-run it without explicit test authorization.

**Priorities:** (1) close one-pass guarded FAST FLOW without automatic QA; (2) disposable owned Node.js Hosting + GitHub import/build/run/update/rollback; (3) Cloudflare/HTTPS/SSH/traffic/files/terminal/backup integrations; (4) official Termux installer; (5) physical Samsung failure/recovery/isolation acceptance **when tests are authorized**.

Protect IleStoi, PhotoMap, Local Agent, Cloudflare, SSH, Mosquitto, existing H2 static sites and data. No Mac, Codex, Work, Actions, public exposure or unowned-service control.

[Historical checkpoint](checkpoints/2026-11-14-pocket-host-fast-flow-hosting-next-chat.md) · [Roadmap](ROADMAP.md) · [Quality](QUALITY_GATES.md).
