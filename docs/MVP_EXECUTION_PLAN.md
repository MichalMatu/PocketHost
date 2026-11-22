---
status: active
owner: product
last_reviewed: 2026-11-22
purpose: Compact current PocketHost MVP acceptance tracker; evidence lives in canonical checkpoint
---

# PocketHost — MVP status and next acceptance

**Current 22 November source and module checkpoint:** [modularity/documentation audit](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Last A8 device evidence:** [21 November checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md). **Resume instructions:** [current handoff](HANDOFF_NEXT_CHAT.md). Historical device details and older failed/skipped QA are preserved in [18 November checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md), [integration receipts](MVP_INTEGRATION_CHECKLIST.md) and Local Agent task results; this is **not a release diary**.

## Version boundary

- **Last verified A8 DEV:** `e4d6a09b2ae6ce7b6290a65df1940f3261d446bd` guarded **DEPLOY PASS**, receipt `pockethost-a8-static-starter-html-e4d6a09-deploy-20261122-v1` (PID **2485**, ticks **72479158**, HTTP **200**, protected services unchanged). Static one-step create + first release supports ZIP/folder/starter HTML; no automatic start. Two newest UI regressions unrun; last scoped seven-category QA PASS at older `9b910d8dc353c512333b290a6749c60ad3df530f`. No actual site import performed.
- **Newest independently executed QA:** `9b910d8dc353c512333b290a6749c60ad3df530f` **PASS** for `format,structure,boundaries,root-lint,root-types,node,syntax` (receipt `pockethost-a8-node-data-qa-9b910d8-20261122-v1`). Former format failures at `590c576` and `6d38d32` are resolved by exact Prettier correction. The older 65/65 UI QA at `6585afe` does not replace newest-browser acceptance. Full G2 and physical G3 remain separate.
- **Static ZIP test-only addition:** `ed1337e9eab4f70f2d393f0339468756b85bf042` added an independent reimport/HTTP regression; A8 `node,syntax` **PASS**, receipt `pockethost-a8-static-zip-reimport-node-qa-ed1337e-20261121-v1`. That test-only commit did not restart the panel. A **later** guarded Node backup code deployment moved the last attested live SHA to `96c2879`.
- **Live ZIP exercise:** API active ZIP export → strict archive decode → independent temporary Static project import/HTTP byte verification **PASS** (1 file, 432 bytes; 550-byte ZIP), original untouched, fixture removed. Receipt `pockethost-a8-live-static-export-isolated-import-6585afe-20261121-v1`. Browser ZIP-upload path and independently durable Static backup remain OPEN.
- The [21 November checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md) is a historical MVP baseline; the [22 November checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md) adds source-only separation findings, not a new device acceptance. `PocketHost` branch inventory only `main`, last checked open PRs **0**; Local Agent `agent-control` is active transport, not cleanup debris. **`photomap.pl` remains unmigrated.**

## Module acceptance matrix

| Moduł                         | Stan                                     | Granica odbioru                                                                                        |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A8 DEV / Local Agent          | DEPLOY PASS; latest UI QA OPEN       | Live e4d6a09 PID 2485, ticks/HTTP/protected services PASS; older QA at 9b910d8                |
| SSH / Terminal                | Scoped functional PASS                   | Mac interactive terminal + disconnect; A8 profile CRUD and dedicated SSH lifecycle PASS on `8e200b6`   |
| Static Hosting                | API ZIP reimport PASS; browser OPEN  | Create from ZIP, folder or sample HTML in one POST deployed; real browser acceptance still OPEN   |
| Trusted Node Hosting          | Core lifecycle PASS                      | Deploy/HTTP/logs/update/stop/start/rollback; untrusted code isolation not implemented                  |
| Hosting / Deployments / Logs  | Basic routes PASS; browser sign-off OPEN | One Static + one Node catalog, pages HTTP 200; current-browser selection not signed off                |
| Backups & Recovery            | Source Restic PASS; mutable data PARTIAL | Detached snapshot UI rejects older async reads and verification receipts; real recovery OPEN      |
| Services S1–S4                | READY_FOR_ACCEPTANCE                     | Owned fixed-template worker exercised; general custom worker/negative cases open                       |
| Mosquitto MQTT                | Loopback MVP PASS                        | Runit + publish/subscribe + CONNACK at `127.0.0.1:1883`; LAN closed                                    |
| Health checks                 | A8 API PASS; browser OPEN                | On-demand Agent/SSH/MQTT/Cloudflare checks; manual button and fault path acceptance open               |
| Autostart / Termux:Boot       | Current-session visibility PASS          | 3/3 executable hooks; physical reboot/startup persistence unverified                                   |
| Cloudflare shared tunnel      | Pi connector observed; new ingress OPEN  | One named tunnel on Pi to Pi `127.0.0.1:8000`; A8 optional connector stopped; no public route added    |
| Android / Companion / Shizuku | PARTIAL / deferred                       | Basic UI and host diagnostics; physical optional bridge and public production mode not qualified       |
| Full repo G2 / physical G3    | NOT CERTIFIED                            | Broad changed-scope QA PASS at 6585afe; coverage/admin build/reboot not certified                      |

**Meaning:** DEPLOY PASS proves applied source, owner/PID/ticks, core HTTP and protected-service isolation. It **does not** prove fresh UI/test acceptance. Old scoped PASS applies only to the task, SHA and exact feature checked.

## Immediate priority — broad functionality before deep refinement

1. **Static ZIP scoped PASS; browser OPEN:** actual A8 export → strict decode → isolated reimport/HTTP byte equality PASS, original unchanged and temporary fixture removed. Next browser upload to a separately created disposable owned site requires safe verified cleanup; do not confuse the isolated host path with browser flow.
2. **Project recovery (next):** detached snapshots remain visible after data-scope failure and reject mismatched receipt metadata; now also discard responses from earlier inspections. Added two unrun UI regressions. Exact-SHA QA, disposable A8 staging and database consistency still OPEN; no real app-data recovery.
3. **One new project end to end:** reuse existing Static ZIP/folder and Node local/GitHub intake; demonstrate deployment, update, logs, health, rollback and retained data. Only after all base features work is `photomap.pl` the proposed real migration.
4. **Cloudflare using Pi only:** inventory current Pi public hostname/DNS, choose a safe owned app on A8, prepare validated ingress candidate with preserved old Pi origin and same named tunnel. Do not route unauthenticated PocketHost admin, SSH or MQTT publicly. No change to DNS/connector yet. [Design](CLOUDFLARE_SHARED_TUNNEL_MVP.md).
5. **Separate physical acceptance:** Android Termux:Boot restore following an explicitly approved reboot; then pending Services S1–S4 worker controls/current-browser selection, scoped negative tests and **only when separately approved** full QA.

## Execution and definition of done

- **CODE:** committed to `main`; **DEPLOY PASS:** one terminal A8 Local Agent exact-SHA/owned-PID/HTTP/protected-services receipt; **SCOPED QA PASS:** separate, expressly approved SHA + selected categories receipt; **OWNER ACCEPTED:** physical/browser behavior and owner decision. Never collapse these statuses.
- Only paired A8 Termux Local Agent performs device commands/builds/deploys/tests, aside from the narrow separately approved Mac Test Lab read-only exception. **No automatic tests**, scheduled checks or retry on unknown task state. Docs-only changes: Git update, **no deployment, build, QA or restart**.
- Keep private DEV panel LAN-only. Preserve protected Local Agent, external services, Pi's live tunnel, user files and credentials. No public exposure, full reboot, off-device transfer or destructive restore without separate scoped permission.
