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

**Latest guarded A8 DEV deployment:** `6d38d32bd25d28b32aacbacd5250c1d7af07454a`, **PASS** (PID **27910**, start ticks **71821899**, HTTP **200**, protected services unchanged), receipt `pockethost-a8-node-data-format-6d38d32-deploy-20261122-v1`. This is a formatting-only follow-up to the empty-directory-preserving Node snapshot code. Approved QA on earlier SHA `590c576` returned **QA_FAIL** at changed-file formatting (receipt `pockethost-a8-node-data-qa-590c576-approved-20261122-v1`); syntax, structure, boundaries, lint PASS; root types and Node tests SKIPPED. New source `6d38d32bd25d28b32aacbacd5250c1d7af07454a` awaits separate exact-SHA QA. **No real data copied/restored**.

**Product scope:** private-LAN DEV panel with scoped Static and trusted Node Hosting, independent Local Agent, dedicated SSH, loopback MQTT, on-demand health and current-session autostart visibility. Static active-ZIP export -> isolated reimport already PASS; **browser ZIP upload remains open**. App mutable uploads/database recovery, generic independent-project lifecycle, reboot, full G2/G3 and off-device recovery remain OPEN. Pi Zero's only Cloudflare connector/origin is unchanged.

[Module ownership and limits](MODULES.md) and [code entry map](CODE_MAP.md) distinguish real implementation from placeholders. No scheduler, Actions, Codex/Work, automatic tests or unapproved changes to live/public systems. Documentation-only edits do not require panel restart.
