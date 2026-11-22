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

**Latest guarded A8 DEV:** `41aa94a34f884ca9b4ab2e92fcfce29783e15cc3` **DEPLOY PASS** (owned PID **18262**, ticks **72326729**, loopback HTTP **200**, protected services unchanged), receipt `pockethost-a8-static-initial-zip-index-41aa94a-deploy-20261122-v1`. Optional first Static ZIP is now checked *before site creation* for a valid bounded classic ZIP central directory and a nonempty `index.html` either at root or under one common top-level directory, matching backend normalization. The server remains authoritative for extracted bytes, paths and CRC. Two unrun UI regressions cover missing homepage and wrapped homepage. Last seven-category scoped QA PASS at older `9b910d8dc353c512333b290a6749c60ad3df530f`. No real site creation or import.

**Product scope:** private-LAN DEV panel with scoped Static and trusted Node Hosting, independent Local Agent, dedicated SSH, loopback MQTT, on-demand health and current-session autostart visibility. Static active-ZIP export -> isolated reimport already PASS; **browser ZIP upload remains open**. App mutable uploads/database recovery, generic independent-project lifecycle, reboot, full G2/G3 and off-device recovery remain OPEN. Pi Zero's only Cloudflare connector/origin is unchanged.

[Module ownership and limits](MODULES.md) and [code entry map](CODE_MAP.md) distinguish real implementation from placeholders. No scheduler, Actions, Codex/Work, automatic tests or unapproved changes to live/public systems. Documentation-only edits do not require panel restart.
