---
status: active
owner: product
last_reviewed: 2026-11-21
purpose: Compact current PocketHost MVP acceptance tracker; evidence lives in canonical checkpoint
---

# PocketHost — MVP status and next acceptance

**Canonical current evidence:** [21 November 2026 A8 checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md). **Resume instructions:** [current handoff](HANDOFF_NEXT_CHAT.md). Historical device details and older failed/skipped QA are preserved in [18 November checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md), [integration receipts](MVP_INTEGRATION_CHECKLIST.md) and Local Agent task results; this is **not a release diary**.

## Version boundary

- **Last verified running A8 panel code:** `6585afee5a67ce2768be9577fd6a7c173b284668`, guarded receipt `pockethost-a8-autostart-refresh-6585afe-deploy-20261121-v1`: **DEPLOY PASS**, PID **8299**, start ticks **70992303**, loopback HTTP **200**, protected services unchanged. Deployment tests not run.
- **Changed-scope QA:** A8 receipt `pockethost-a8-qa-closure-6585afe-20261121-v1` **PASS** across 53 changed paths: format, structure, boundaries, docs, Markdown, both lint/typecheck scopes, Node, UI and syntax. Does **not** certify full G2 coverage, admin build or device reboot.
- **Later test-only code:** `ed1337e9eab4f70f2d393f0339468756b85bf042` added an independent Static ZIP reimport/HTTP regression; A8 `node,syntax` **PASS**, receipt `pockethost-a8-static-zip-reimport-node-qa-ed1337e-20261121-v1`. No panel restart; live code remains `6585afe`.
- **Live ZIP exercise:** API active ZIP export → strict archive decode → independent temporary Static project import/HTTP byte verification **PASS** (1 file, 432 bytes; 550-byte ZIP), original untouched, fixture removed. Receipt `pockethost-a8-live-static-export-isolated-import-6585afe-20261121-v1`. Browser ZIP-upload path and independently durable Static backup remain OPEN.
- The [canonical checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md) is a historical MVP baseline. `PocketHost` branch inventory only `main`, last checked open PRs **0**; Local Agent `agent-control` is active transport, not cleanup debris. **`photomap.pl` remains unmigrated.**

## Module acceptance matrix

| Moduł                         | Stan                                     | Granica odbioru                                                                                        |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A8 DEV / Local Agent            | Operational DEPLOY + scoped QA PASS      | Live 6585afe; owner PID/ticks/HTTP/protected services PASS; changed-scope Node/UI QA PASS                  |
| SSH / Terminal                | Scoped functional PASS                   | Mac interactive terminal + disconnect; A8 profile CRUD and dedicated SSH lifecycle PASS on `8e200b6`   |
| Static Hosting                  | Core + isolated ZIP PASS; browser OPEN   | Real A8 ZIP export and isolated import/HTTP equality PASS; browser ZIP upload still open                   |
| Trusted Node Hosting          | Core lifecycle PASS                      | Deploy/HTTP/logs/update/stop/start/rollback; untrusted code isolation not implemented                  |
| Hosting / Deployments / Logs  | Basic routes PASS; browser sign-off OPEN | One Static + one Node catalog, pages HTTP 200; current-browser selection not signed off                |
| Backups & Recovery              | Local Node Restic narrowly PASS          | Static ZIP portable copy PASS; persistent app data and independent/off-device recovery open                |
| Services S1–S4                | READY_FOR_ACCEPTANCE                     | Owned fixed-template worker exercised; general custom worker/negative cases open                       |
| Mosquitto MQTT                | Loopback MVP PASS                        | Runit + publish/subscribe + CONNACK at `127.0.0.1:1883`; LAN closed                                    |
| Health checks                 | A8 API PASS; browser OPEN                | On-demand Agent/SSH/MQTT/Cloudflare checks; manual button and fault path acceptance open               |
| Autostart / Termux:Boot       | Current-session visibility PASS          | 3/3 executable hooks; physical reboot/startup persistence unverified                                   |
| Cloudflare shared tunnel      | Pi connector observed; new ingress OPEN  | One named tunnel on Pi to Pi `127.0.0.1:8000`; A8 optional connector stopped; no public route added    |
| Android / Companion / Shizuku | PARTIAL / deferred                       | Basic UI and host diagnostics; physical optional bridge and public production mode not qualified       |
| Full repo G2 / physical G3      | NOT CERTIFIED                            | Broad changed-scope QA PASS at 6585afe; coverage/admin build/reboot not certified                          |

**Meaning:** DEPLOY PASS proves applied source, owner/PID/ticks, core HTTP and protected-service isolation. It **does not** prove fresh UI/test acceptance. Old scoped PASS applies only to the task, SHA and exact feature checked.

## Immediate priority — broad functionality before deep refinement

1. **Static ZIP scoped PASS; browser OPEN:** actual A8 export → strict decode → isolated reimport/HTTP byte equality PASS, original unchanged and temporary fixture removed. Next browser upload to a separately created disposable owned site requires safe verified cleanup; do not confuse the isolated host path with browser flow.
2. **Project recovery (next):** define app-owned persistent uploads/database/state and test backup→**isolated** restore on a fixture. Current Static versions are rollback history, not an independent backup; Node's earlier local Restic PASS need not be repeated. **Off-device Restic is deferred** until owner chooses destination and authorizes it.
3. **One new project end to end:** reuse existing Static ZIP/folder and Node local/GitHub intake; demonstrate deployment, update, logs, health, rollback and retained data. Only after all base features work is `photomap.pl` the proposed real migration.
4. **Cloudflare using Pi only:** inventory current Pi public hostname/DNS, choose a safe owned app on A8, prepare validated ingress candidate with preserved old Pi origin and same named tunnel. Do not route unauthenticated PocketHost admin, SSH or MQTT publicly. No change to DNS/connector yet. [Design](CLOUDFLARE_SHARED_TUNNEL_MVP.md).
5. **Separate physical acceptance:** Android Termux:Boot restore following an explicitly approved reboot; then pending Services S1–S4 worker controls/current-browser selection, scoped negative tests and **only when separately approved** full QA.

## Execution and definition of done

- **CODE:** committed to `main`; **DEPLOY PASS:** one terminal A8 Local Agent exact-SHA/owned-PID/HTTP/protected-services receipt; **SCOPED QA PASS:** separate, expressly approved SHA + selected categories receipt; **OWNER ACCEPTED:** physical/browser behavior and owner decision. Never collapse these statuses.
- Only paired A8 Termux Local Agent performs device commands/builds/deploys/tests, aside from the narrow separately approved Mac Test Lab read-only exception. **No automatic tests**, scheduled checks or retry on unknown task state. Docs-only changes: Git update, **no deployment, build, QA or restart**.
- Keep private DEV panel LAN-only. Preserve protected Local Agent, external services, Pi's live tunnel, user files and credentials. No public exposure, full reboot, off-device transfer or destructive restore without separate scoped permission.
