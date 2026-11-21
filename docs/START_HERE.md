---
status: active
owner: core
last_reviewed: 2026-11-21
purpose: Minimal PocketHost entrypoint and verified A8 resume links
---

# PocketHost — start here

1. Read [mandatory agent rules](../AGENTS.md), the [current handoff](HANDOFF_NEXT_CHAT.md) and the [MVP tracker](MVP_EXECUTION_PLAN.md).
2. Use the **[21 November 2026 canonical A8 checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md)** for evidence, module acceptance, deployed versus docs-only SHA and next work. Older material is in the [checkpoint index](checkpoints/README.md); do not preload it.
3. Before any change, independently verify current Git `main`, actual live A8 SHA, protected service ownership and the nearest scoped `AGENTS.md`. Use [A8 Local Agent transport](LOCAL_AGENT_TERMUX.md), [FAST FLOW rules](DEV_ITERATION.md) and the separately authorized [Mac Test Lab](TEST_LAB.md) only as scoped.

**Last verified A8 DEV code:** `96c2879d20fcfcbb6c59832e4706775adfec7ff4`, guarded **DEPLOY PASS**, HTTP 200, protected services unchanged. A8 scoped Node backup verification **PASS** at follow-up test-only `73b2da8`; prior broad changed-scope QA **PASS** at `6585afe` (65/65 UI). Mutable uploads/databases remain outside the verified backup scope. See [current handoff](HANDOFF_NEXT_CHAT.md).

**Working MVP:** private-LAN PocketHost + trusted Static and Node Hosting core, dedicated SSH, loopback MQTT, on-demand health and Autostart observation. Pi Zero's **single existing Cloudflare connector** remains unchanged. No public admin exposure.

**Current priority:** live Static ZIP export → isolated reimport **PASS** on A8 (1 file, 432 bytes, HTTP bytes matched; original untouched, fixture removed). Browser upload into a separately created persistent site remains OPEN. Next: persistent app data backup/recovery on an isolated fixture, then one generic independent project, **not `photomap.pl` yet**. Reboot, full G2/G3, public routing and off-device recovery remain open/deferred.

**Do not** run automatic tests, schedule tasks, use Codex/Work/Actions, silently retry an unknown task, change Pi tunnel/DNS, transfer secrets/data or reboot without separate authorization. Documentation-only edits never require panel restart.
