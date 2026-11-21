---
status: active
owner: product
last_reviewed: 2026-11-21
purpose: Compact current PocketHost MVP acceptance tracker; evidence lives in canonical checkpoint
---

# PocketHost — MVP status and next acceptance

**Canonical current evidence:** [21 November 2026 A8 checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md). **Resume instructions:** [current handoff](HANDOFF_NEXT_CHAT.md). Historical device details and older failed/skipped QA are preserved in [18 November checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md), [integration receipts](MVP_INTEGRATION_CHECKLIST.md) and Local Agent task results; this is **not a release diary**.

## Version boundary

- **Last verified running A8 panel code:** `76fb23ace36ae01783c7055c79255731e3e79ce5`, receipt `pockethost-a8-qa-remediation-76fb23a-deploy-20261121-v1`: exact-SHA **DEPLOY PASS**, PID **18469**, start ticks **68924890**, HTTP **200**, protected services unchanged, **tests not run**.
- The 21 November canonical checkpoint is a **historical MVP baseline**. Subsequent code-quality refactors and the Static ZIP error-diagnostic fix were deployed through the receipt above. The present documentation update is **docs-only** and does not change the A8 runtime. Read Git HEAD and fresh actual A8 live SHA before new work.
- `PocketHost` branch inventory **only `main`**, open PRs **0**; nothing eligible for branch cleanup. Local Agent's separate active `agent-control` branch is transport infrastructure and is retained.
- **QA boundary:** one-shot check for `be32b15c` failed formatting (11 files), docs metadata/index and 3 lint imports; structure, boundaries, Markdown lint passed; typechecks and Node/UI suites skipped. `76fb23a` remediates lint/docs/type import but has **no fresh QA**. New scope-and-SHA consent required.
- **`photomap.pl` not yet imported or migrated**, by owner decision. Use a disposable independent project to qualify remaining flows first.

## Module acceptance matrix

| Moduł                         | Stan                                     | Granica odbioru                                                                                        |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A8 DEV / Local Agent          | Operational DEPLOY PASS                  | Exact live code `76fb23ac` and owned PID/HTTP attested; no latest-SHA broad QA                         |
| SSH / Terminal                | Scoped functional PASS                   | Mac interactive terminal + disconnect; A8 profile CRUD and dedicated SSH lifecycle PASS on `8e200b6`   |
| Static Hosting                | Core lifecycle PASS; ZIP QA OPEN         | Create/publish/v2/start/rollback previously accepted; active ZIP download deployed, re-import untested |
| Trusted Node Hosting          | Core lifecycle PASS                      | Deploy/HTTP/logs/update/stop/start/rollback; untrusted code isolation not implemented                  |
| Hosting / Deployments / Logs  | Basic routes PASS; browser sign-off OPEN | One Static + one Node catalog, pages HTTP 200; current-browser selection not signed off                |
| Backups & Recovery            | Local Node Restic narrowly PASS          | Project coverage view deployed; Static ZIP, app data and independent restore incomplete                |
| Services S1–S4                | READY_FOR_ACCEPTANCE                     | Owned fixed-template worker exercised; general custom worker/negative cases open                       |
| Mosquitto MQTT                | Loopback MVP PASS                        | Runit + publish/subscribe + CONNACK at `127.0.0.1:1883`; LAN closed                                    |
| Health checks                 | A8 API PASS; browser OPEN                | On-demand Agent/SSH/MQTT/Cloudflare checks; manual button and fault path acceptance open               |
| Autostart / Termux:Boot       | Current-session visibility PASS          | 3/3 executable hooks; physical reboot/startup persistence unverified                                   |
| Cloudflare shared tunnel      | Pi connector observed; new ingress OPEN  | One named tunnel on Pi to Pi `127.0.0.1:8000`; A8 optional connector stopped; no public route added    |
| Android / Companion / Shizuku | PARTIAL / deferred                       | Basic UI and host diagnostics; physical optional bridge and public production mode not qualified       |
| Full repo G2 / physical G3    | NOT CERTIFIED                            | Earlier scoped tests only; no broad latest-SHA QA and no reboot                                        |

**Meaning:** DEPLOY PASS proves applied source, owner/PID/ticks, core HTTP and protected-service isolation. It **does not** prove fresh UI/test acceptance. Old scoped PASS applies only to the task, SHA and exact feature checked.

## Immediate priority — broad functionality before deep refinement

1. **Static ZIP closed loop:** separate approved manual QA on exact code SHA: export actual active ZIP, validate CRC/paths/files, import to a **new disposable owned Static project**, compare bytes/HTTP, check original untouched, clean only the fixture. Do not replace existing import.
2. **Project recovery:** define app-owned persistent uploads/database/state and test backup→**isolated** restore on a fixture. Current Static versions are rollback history, not an independent backup; Node's earlier local Restic PASS need not be repeated. **Off-device Restic is deferred** until owner chooses destination and authorizes it.
3. **One new project end to end:** reuse existing Static ZIP/folder and Node local/GitHub intake; demonstrate deployment, update, logs, health, rollback and retained data. Only after all base features work is `photomap.pl` the proposed real migration.
4. **Cloudflare using Pi only:** inventory current Pi public hostname/DNS, choose a safe owned app on A8, prepare validated ingress candidate with preserved old Pi origin and same named tunnel. Do not route unauthenticated PocketHost admin, SSH or MQTT publicly. No change to DNS/connector yet. [Design](CLOUDFLARE_SHARED_TUNNEL_MVP.md).
5. **Separate physical acceptance:** Android Termux:Boot restore following an explicitly approved reboot; then pending Services S1–S4 worker controls/current-browser selection, scoped negative tests and **only when separately approved** full QA.

## Execution and definition of done

- **CODE:** committed to `main`; **DEPLOY PASS:** one terminal A8 Local Agent exact-SHA/owned-PID/HTTP/protected-services receipt; **SCOPED QA PASS:** separate, expressly approved SHA + selected categories receipt; **OWNER ACCEPTED:** physical/browser behavior and owner decision. Never collapse these statuses.
- Only paired A8 Termux Local Agent performs device commands/builds/deploys/tests, aside from the narrow separately approved Mac Test Lab read-only exception. **No automatic tests**, scheduled checks or retry on unknown task state. Docs-only changes: Git update, **no deployment, build, QA or restart**.
- Keep private DEV panel LAN-only. Preserve protected Local Agent, external services, Pi's live tunnel, user files and credentials. No public exposure, full reboot, off-device transfer or destructive restore without separate scoped permission.
