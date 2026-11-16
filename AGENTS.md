# PocketHost — mandatory agent rules

## Entry

Read this file, docs/START_HERE.md, **docs/MVP_EXECUTION_PLAN.md** and only the nearest scoped AGENTS.md; use fresh main HEAD. The MVP tracker governs task order, status and acceptance; no preload of historical checkpoints.

## Execution

- Main only. GitHub Connector is source/task transport; **only verified Samsung Termux Local Agent** runs builds, device actions and any owner-authorized tests. Never Mac, ChatGPT sandbox, Codex, Work or GitHub Actions.
- Default workflow, in **one agent task**: **code → deploy → verify**. Commit the change, perform the permitted guarded update of the verified PocketHost-owned DEV panel, then read back the running revision, process ownership and basic health. Report one terminal exact-SHA deployment receipt. Do not split these stages into multiple jobs or duplicate an existing job.
- **GLOBAL TESTS OFF — EVERY MODE, EVERY STAGE, EVERY RELEASE.** Prior owner permission for stage-close tests was withdrawn on 2026-11-15. Do not infer permission from a task, milestone, stage completion, request to continue, deploy, audit, verify, or this document. **Each single test/QA/lint/typecheck/format/smoke run requires fresh, explicit owner confirmation that names its exact scope.** Never invoke `--tests`: FAST FLOW rejects it. A separately approved A8 `verify-changed.mjs --execute --approved-head=<exact target SHA> --approved-checks=<named categories> --base=<live SHA>` is the only orchestration-supported manual quality gate. The CLI flags document intent; they do not prove that the user consented. Ask first. Physical reboot, SSH/external-service mutations and WAN still require additional distinct consent.
- Deployment safety checks remain mandatory: establish process ownership, live revision, protected-service isolation and rollback eligibility before updating. These operational safeguards are not authorization to run test suites. On unsafe state or unavailable Samsung agent, report HOLD; do not bypass guards or claim deployment.
- **Verification is not testing:** read back live/installed SHA, owner PID/start ticks, protected-service isolation and baseline HTTP. No functional routes, unit tests, UI tests, lint, formatting, typecheck or QA without a new explicit approval. Build/run required to serve the panel is not a test suite.
- A commit or queued task is not a deployed PASS. Unknown result means HOLD. No automatic retries.
- Docs-only changes: commit to Git only; **no automatic documentation checks, build or panel restart**. Preserve dependencies/caches.

## Safety

- Discovered processes/sites are external until separately verified. Never stop/change/adopt unrelated hosted projects, third-party services, the independent Local Agent, SSH, tunnels, brokers or unrelated data without verified enrollment.
- Only the verified PocketHost DEV panel has its existing runit restart/rollback exception. Check PID, start ticks, cwd, source and protected services first.
- No unsolicited shell, global upgrades, WAN exposure or hidden credential logs. Private LAN DEV UI has no auth/TLS; ADB is not root.

## Product and gates

Basic = universal official-Termux Hosting (H2 static separate from Node), without any hardcoded hosted project/domain/service. Panel-owned settings cover trusted LAN without login (never WAN), runit/Termux:Boot autostart, per-service health/recovery and SSH/Git/GitHub configuration; implement them with strict host/ownership gates, not hidden per-project scripts. Pro/Companion/Shizuku expansion and unified APK deferred. Host/process/permission changes must retain fail-closed deployment checks. Positive/negative regression testing at stage close is **pending a separate owner decision each time**, not automatically authorized by reaching a milestone. Source DEV ≠ G2/G3 physical release.

## Services interface rule

Services must remain independently navigable from the sidebar: overview only links
to dedicated Runit lifecycle, Autostart, Hosting, Health, Local Agent, SSH and other
service-specific pages. No single page should load or control the entire stack.
The same backend owner and fail-closed safety gates apply in every subpage.

## Current Samsung target (A8 installed)

**Samsung Galaxy A8 only** for PocketHost execution. Latest verified live
DEV SHA: `64c92f3b825df015095bea041fbb529ed1e7d7fb`, PID **25555**, HTTP **200**, owned panel/watch and
independent Local Agent running; protected services unchanged.
Terminal FAST FLOW receipt:
`pockethost-a8-stabilization-restic-readback-fast-flow-20261116-v1`
(done, exit 0, PASS). Exact current source differs from the last manually
approved **7/7 QA** at `c0bf02184c804d93fca7a50cddbdd9b1146ee2c8`.
**No QA, lint, typecheck, formatting or smoke suite was run on the newer SHA.**

One bounded owned fixed-template worker passed physical Create → Start →
Health / Logs / Recovery review → Stop → Archive → Restore → Retire on A8
(receipt `pockethost-a8-s1-s4-complete-owned-flow-396058d2-20261116-v1`).
S3 Android startup after reboot, arbitrary source execution, generic
hosting release/rollback and full Backup → Restore are not physically accepted.
Platform settings readback, Hosting static release readback, and Restic
UI receipt validation are deployed but not independently QA-tested.
No standing scheduler, reboot, protected SSH, WAN or S22 changes.
See [active handoff](docs/HANDOFF_NEXT_CHAT.md).

## MVP stage acceptance

Follow [the canonical plan and tracker](docs/MVP_EXECUTION_PLAN.md) in order: Services → Platform → Hosting → stabilization. Each stage needs exact-SHA terminal deployment receipt, read-only owner/HTTP/LAN evidence, concise report and explicit owner acceptance. **Tests are not automatically triggered at stage completion**; report TESTS NOT RUN and ask the owner for a separately scoped test authorization if test evidence is required for acceptance. READY_FOR_ACCEPTANCE is not ACCEPTED. Check off only proven work. Docs-only changes never restart the panel.
