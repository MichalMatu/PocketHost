---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Minimal PocketHost entrypoint and current verified-evidence pointers
---

# PocketHost — start here

1. Read [mandatory rules](../AGENTS.md), [current handoff](HANDOFF_NEXT_CHAT.md) and the [MVP acceptance tracker](MVP_EXECUTION_PLAN.md).
2. For **latest source/modularity and documentation status**, read the [22 November checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). The [21 November A8 checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md) and older material are historical evidence, not current `main` or fresh device state.
3. Before code/device changes verify Git `main`, A8 live SHA and protected service ownership; follow [Local Agent transport](LOCAL_AGENT_TERMUX.md), [FAST FLOW](DEV_ITERATION.md) and the nearest scoped `AGENTS.md`.

**Latest guarded A8 DEV:** `50bbfdd8dec78616def7f10c7d50a97de3dfe5fa` **DEPLOY PASS** (owned PID **21774**, start ticks **72361760**, loopback HTTP **200**, protected services unchanged), receipt `pockethost-a8-static-single-import-50bbfdd-deploy-20261122-v1`. Initial Static ZIP import now uses one owner-intent `POST /api/v1/sites/import?name=<encoded>`: the server validates the archive before allocating an owned site, then creates and publishes the first stopped release in one serialized request. The UI independently checks both the owned inventory and the exact site before claiming success. Four updated/added frontend scenarios committed but **not run**; latest independent scoped seven-category QA remains older `9b910d8dc353c512333b290a6749c60ad3df530f`. No actual user-site import was performed.

**Product scope:** private-LAN DEV panel with scoped Static and trusted Node Hosting, independent Local Agent, dedicated SSH, loopback MQTT, on-demand health and current-session autostart visibility. Static active-ZIP export -> isolated reimport already PASS; **browser ZIP upload remains open**. App mutable uploads/database recovery, generic independent-project lifecycle, reboot, full G2/G3 and off-device recovery remain OPEN. Pi Zero's only Cloudflare connector/origin is unchanged.

[Module ownership and limits](MODULES.md) and [code entry map](CODE_MAP.md) distinguish real implementation from placeholders. No scheduler, Actions, Codex/Work, automatic tests or unapproved changes to live/public systems. Documentation-only edits do not require panel restart.
