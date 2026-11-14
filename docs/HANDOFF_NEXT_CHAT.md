---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Minimal next-chat entry and PocketHost sprint priorities
---

# PocketHost — next chat

**First action:** read fresh `main` HEAD, [root AGENTS](../AGENTS.md) and actual live Samsung panel ownership/revision evidence. Never treat a source commit as deployed. Last confirmed live panel in historical checkpoint: `f37d0bc` (must revalidate). The old FAST FLOW attempt at `d801da7` was HOLD with no deployment.

**Default:** **code → deploy → verify** in one verified Samsung Local Agent task, using [FAST FLOW](DEV_ITERATION.md). **No tests, formatting, lint, typecheck, route smoke or documentation checks until the owner explicitly says it is time for tests.** Do not queue duplicate jobs or retry missing receipts. Previous documentation task `pockethost-md-final-check-da72da3-20261114-v1` had no confirmed receipt; do not re-run it without explicit test authorization.

**Current priority:** [Termux recovery and clean bootstrap](TERMUX_REBUILD_RECOVERY.md): **no backup passwords, no encryption and no Restic**. One verified plaintext PhotoMap database and one IleStoi database exported to Android Downloads, old temporary snapshots and unused Restic password deleted. Full unencrypted `home + usr` TAR task `termux-rebuild-plain-full-archive-20261114-v1` submitted, verify terminal receipt first; then off-device copy and isolated restore. **Do not erase or stop anything before separate owner approval**. Then reconstruct SSH/GitHub/Local Agent/PocketHost and each service one at a time, with dedicated controls and no duplicate data. Previous product Hosting sprint is deferred behind recoverability.

Protect IleStoi, PhotoMap, Local Agent, Cloudflare, SSH, Mosquitto, existing H2 static sites and data. No Mac, Codex, Work, Actions, public exposure or unowned-service control.

[Historical checkpoint](checkpoints/2026-11-14-pocket-host-fast-flow-hosting-next-chat.md) · [Roadmap](ROADMAP.md) · [Quality](QUALITY_GATES.md).
