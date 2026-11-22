---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Minimal PocketHost entrypoint and current verified-evidence pointers
---

# PocketHost — start here

1. Read [mandatory rules](../AGENTS.md), [current handoff](HANDOFF_NEXT_CHAT.md) and the [MVP acceptance tracker](MVP_EXECUTION_PLAN.md).
2. For **current deployment and night code queue**, read the [post-demo checkpoint](checkpoints/2026-11-22-demo-cleanup-overnight-handoff.md) and [night plan](NIGHT_AUTONOMOUS_SPRINT.md). For module analysis, see the [22 November module checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). The [21 November A8 checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md) and older material are historical evidence, not current `main` or fresh device state.
3. Before code/device changes verify Git `main`, A8 live SHA and protected service ownership; follow [Local Agent transport](LOCAL_AGENT_TERMUX.md), [FAST FLOW](DEV_ITERATION.md) and the nearest scoped `AGENTS.md`.

**Latest guarded A8 DEV:** `d0468ab0e4e7b2830c998aab6f406b2f15ad5a0b` guarded **DEPLOY PASS** (PID **12014**, start ticks **73133851**, HTTP **200**, protected services unchanged), receipt `pockethost-a8-demo-removal-d0468ab-deploy-20261122-v1`. Upstream framework/CMS showcase routes and demo assets removed. Latest `d0468ab0e4e7b2830c998aab6f406b2f15ad5a0b` targeted format/UI regression **PASS**; preceding `8f68257` syntax/format/structure/lint/TS/Node **PASS**. Broad G2 and actual browser ZIP/folder/HTML import remain **OPEN**. Current [checkpoint](checkpoints/2026-11-22-demo-cleanup-overnight-handoff.md) and [autonomous next coding queue](NIGHT_AUTONOMOUS_SPRINT.md) supersede old device snapshot notes.

**Product scope:** private-LAN DEV panel with scoped Static and trusted Node Hosting, independent Local Agent, dedicated SSH, loopback MQTT, on-demand health and current-session autostart visibility. Static active-ZIP export -> isolated reimport already PASS; **browser ZIP upload remains open**. App mutable uploads/database recovery, generic independent-project lifecycle, reboot, full G2/G3 and off-device recovery remain OPEN. Pi Zero's only Cloudflare connector/origin is unchanged.

[Module ownership and limits](MODULES.md) and [code entry map](CODE_MAP.md) distinguish real implementation from placeholders. No scheduler, Actions or Codex/Work. Necessary non-destructive A8 QA is authorized by the owner across future sprints without per-SHA questions; execution remains exact-SHA pinned and separate from deployment. Live/public changes and disruptive operations require distinct consent. Documentation-only edits do not require panel restart.
