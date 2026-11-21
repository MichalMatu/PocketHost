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

**Last verified A8 DEV code:** `6585afee5a67ce2768be9577fd6a7c173b284668` (guarded receipt `pockethost-a8-autostart-refresh-6585afe-deploy-20261121-v1`: **DEPLOY PASS**, PID 8299, start ticks 70992303, loopback HTTP 200, protected services unchanged). Independent changed-scope QA, including UI, **PASS** at this SHA (`pockethost-a8-qa-closure-6585afe-20261121-v1`). A later test-only commit `ed1337e9eab4f70f2d393f0339468756b85bf042` passed Node and syntax QA without restarting or updating the live panel. See [current handoff](HANDOFF_NEXT_CHAT.md).

**Working MVP:** private-LAN PocketHost + trusted Static and Node Hosting core, dedicated SSH, loopback MQTT, on-demand health and Autostart observation. Pi Zero's **single existing Cloudflare connector** remains unchanged. No public admin exposure.

**Current priority:** live Static ZIP export → isolated reimport **PASS** on A8 (1 file, 432 bytes, HTTP bytes matched; original untouched, fixture removed). Browser upload into a separately created persistent site remains OPEN. Next: persistent app data backup/recovery on an isolated fixture, then one generic independent project, **not `photomap.pl` yet**. Reboot, full G2/G3, public routing and off-device recovery remain open/deferred.

**Do not** run automatic tests, schedule tasks, use Codex/Work/Actions, silently retry an unknown task, change Pi tunnel/DNS, transfer secrets/data or reboot without separate authorization. Documentation-only edits never require panel restart.
