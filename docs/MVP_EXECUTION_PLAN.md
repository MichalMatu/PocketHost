---
status: active
owner: product
last_reviewed: 2026-11-22
purpose: Compact current PocketHost MVP acceptance tracker; evidence lives in canonical checkpoint
---

# PocketHost — MVP status and next acceptance

**Current 22 November source and module checkpoint:** [modularity/documentation audit](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). **Latest A8 device receipts:** [current handoff](HANDOFF_NEXT_CHAT.md); [21 November checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md) is historical. **Resume instructions:** [current handoff](HANDOFF_NEXT_CHAT.md). Historical device details and older failed/skipped QA are preserved in [18 November checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md), [integration receipts](MVP_INTEGRATION_CHECKLIST.md) and Local Agent task results; this is **not a release diary**.

## Version boundary

- **Last verified A8 DEV:** `d0468ab0e4e7b2830c998aab6f406b2f15ad5a0b`, guarded **DEPLOY PASS** `pockethost-a8-demo-removal-d0468ab-deploy-20261122-v1`: PID **12014**, ticks **73133851**, HTTP **200**, protected services unchanged. Source cleanup removed 158 tracked demo files (6,083,773 Git blob bytes); preserved PocketHost management and Appearance.
- **A8 QA:** `8f68257` core scope **PASS** (syntax, format, structure, root lint, admin TypeScript, Node); `d0468ab` affected platform UI + format **PASS**. Earlier full UI run hit its time limit and is not G2 evidence. More details: [latest checkpoint](checkpoints/2026-11-22-demo-cleanup-overnight-handoff.md).
- **Static ZIP evidence:** API active-ZIP export → strict decode → isolated reimport/HTTP equality **PASS** historically; real browser upload/import is **OPEN**. Mutable Node data consistency and recovery remain **OPEN**. `photomap.pl` is not migrated.
- **Night code queue:** [N1–N5 autonomous plan](NIGHT_AUTONOMOUS_SPRINT.md), with fast change-dependent QA and no full-suite default. Physical/browser acceptance and public operations remain separately scoped.

## Module acceptance matrix

| Moduł                         | Stan                                        | Granica odbioru                                                                                      |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A8 DEV / Local Agent          | DEPLOY + scoped UI QA PASS; physical OPEN   | Live d0468ab PID 12014, HTTP 200, protected services unchanged; scoped Node/TS/UI QA PASS            |
| SSH / Terminal                | Scoped functional PASS                      | Mac interactive terminal + disconnect; A8 profile CRUD and dedicated SSH lifecycle PASS on `8e200b6` |
| Static Hosting                | API ZIP + UI regressions PASS; browser OPEN | ZIP/folder/custom HTML and stale-read UI regression QA PASS; real browser acceptance OPEN            |
| Trusted Node Hosting          | Core lifecycle PASS                         | Deploy/HTTP/logs/update/stop/start/rollback; untrusted code isolation not implemented                |
| Hosting / Deployments / Logs  | Basic routes PASS; browser sign-off OPEN    | One Static + one Node catalog, pages HTTP 200; current-browser selection not signed off              |
| Backups & Recovery            | Source Restic PASS; mutable data PARTIAL    | Detached snapshot UI rejects older async reads and verification receipts; real recovery OPEN         |
| Services S1–S4                | READY_FOR_ACCEPTANCE                        | Owned fixed-template worker exercised; general custom worker/negative cases open                     |
| Mosquitto MQTT                | Loopback MVP PASS                           | Runit + publish/subscribe + CONNACK at `127.0.0.1:1883`; LAN closed                                  |
| Health checks                 | A8 API PASS; browser OPEN                   | On-demand Agent/SSH/MQTT/Cloudflare checks; manual button and fault path acceptance open             |
| Autostart / Termux:Boot       | Current-session visibility PASS             | 3/3 executable hooks; physical reboot/startup persistence unverified                                 |
| Cloudflare shared tunnel      | Pi connector observed; new ingress OPEN     | One named tunnel on Pi to Pi `127.0.0.1:8000`; A8 optional connector stopped; no public route added  |
| Android / Companion / Shizuku | PARTIAL / deferred                          | Basic UI and host diagnostics; physical optional bridge and public production mode not qualified     |
| Full repo G2 / physical G3    | NOT CERTIFIED                               | Broad changed-scope QA PASS at 6585afe; coverage/admin build/reboot not certified                    |

**Meaning:** DEPLOY PASS proves applied source, owner/PID/ticks, core HTTP and protected-service isolation. It **does not** prove fresh UI/test acceptance. Old scoped PASS applies only to the task, SHA and exact feature checked.

## Immediate priority — broad functionality before deep refinement

1. **Static ZIP scoped PASS; browser OPEN:** actual A8 export → strict decode → isolated reimport/HTTP byte equality PASS, original unchanged and temporary fixture removed. Next browser upload to a separately created disposable owned site requires safe verified cleanup; do not confuse the isolated host path with browser flow.
2. **Project recovery (next):** detached snapshots remain visible after data-scope failure and reject mismatched receipt metadata; now also discard responses from earlier inspections. Added two unrun UI regressions. Exact-SHA QA, disposable A8 staging and database consistency still OPEN; no real app-data recovery.
3. **One new project end to end:** reuse existing Static ZIP/folder and Node local/GitHub intake; demonstrate deployment, update, logs, health, rollback and retained data. Only after all base features work is `photomap.pl` the proposed real migration.
4. **Cloudflare using Pi only:** inventory current Pi public hostname/DNS, choose a safe owned app on A8, prepare validated ingress candidate with preserved old Pi origin and same named tunnel. Do not route unauthenticated PocketHost admin, SSH or MQTT publicly. No change to DNS/connector yet. [Design](CLOUDFLARE_SHARED_TUNNEL_MVP.md).
5. **Separate physical acceptance:** Android Termux:Boot restore following an explicitly approved reboot; then pending Services S1–S4 worker controls/current-browser selection, scoped negative tests and **only when separately approved** full QA.

## Execution and definition of done

- **CODE:** committed to `main`; **DEPLOY PASS:** one terminal A8 Local Agent exact-SHA/owned-PID/HTTP/protected-services receipt; **SCOPED QA PASS:** separate exact-SHA + selected categories terminal receipt (standing owner QA consent); **OWNER ACCEPTED:** physical/browser behavior and owner decision. Never collapse these statuses.
- Only paired A8 Termux Local Agent performs device commands/builds/deploys/tests, aside from the narrow separately approved Mac Test Lab read-only exception. **Only one-shot relevant QA on A8 under standing consent**; no recurring scheduled checks or retries of unknown tasks. Docs-only changes: Git update, **no deployment, build, QA or restart**.
- Keep private DEV panel LAN-only. Preserve protected Local Agent, external services, Pi's live tunnel, user files and credentials. No public exposure, full reboot, off-device transfer or destructive restore without separate scoped permission.
