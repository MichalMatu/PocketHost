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

**Latest guarded A8 DEV:** `d2d5564ecc363b3542b3cd398e7104cf3ccc8d9d` guarded **DEPLOY PASS** (owned PID **6977**, start ticks **72514111**, loopback HTTP **200**, protected services unchanged), receipt `pockethost-a8-custom-initial-html-d2d5564-deploy-20261122-v1`. The new-site starter HTML mode now supports editing the initial `index.html` before creation, resetting to the bundled sample, and rejecting blank/over-32-KiB UTF-8 input before any write. ZIP/folder and plain-empty creation are unchanged. The site stays stopped; the first immutable release is confirmed against independent exact-site and inventory readbacks. Three new UI fixtures unrun. Latest scoped seven-category QA PASS remains older `9b910d8dc353c512333b290a6749c60ad3df530f`; browser acceptance OPEN.

**Product scope:** private-LAN DEV panel with scoped Static and trusted Node Hosting, independent Local Agent, dedicated SSH, loopback MQTT, on-demand health and current-session autostart visibility. Static active-ZIP export -> isolated reimport already PASS; **browser ZIP upload remains open**. App mutable uploads/database recovery, generic independent-project lifecycle, reboot, full G2/G3 and off-device recovery remain OPEN. Pi Zero's only Cloudflare connector/origin is unchanged.

[Module ownership and limits](MODULES.md) and [code entry map](CODE_MAP.md) distinguish real implementation from placeholders. No scheduler, Actions or Codex/Work. Necessary non-destructive A8 QA is authorized by the owner across future sprints without per-SHA questions; execution remains exact-SHA pinned and separate from deployment. Live/public changes and disruptive operations require distinct consent. Documentation-only edits do not require panel restart.
