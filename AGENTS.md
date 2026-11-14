# PocketHost — mandatory agent rules

## Entry

Read this file, docs/START_HERE.md and only the nearest scoped AGENTS.md; use fresh main HEAD. No preload of checkpoints, roadmaps or old evidence.

## Execution

- Main only. GitHub Connector is source/task transport; **only verified Samsung Termux Local Agent** runs builds, device actions and any owner-authorized tests. Never Mac, ChatGPT sandbox, Codex, Work or GitHub Actions.
- Default workflow, in **one agent task**: **code → deploy → verify**. Commit the change, perform the permitted guarded update of the verified PocketHost-owned DEV panel, then read back the running revision, process ownership and basic health. Report one terminal exact-SHA deployment receipt. Do not split these stages into multiple jobs or duplicate an existing job.
- **No tests by default.** Unit, integration, E2E, regression, QA, smoke, lint, formatting, typecheck, test suites and documentation checks run **only when the owner explicitly says it is time for tests**. A code change or deployment request does not authorize tests. FAST FLOW must not run test commands implicitly.
- Deployment safety checks remain mandatory: establish process ownership, live revision, protected-service isolation and rollback eligibility before updating. These operational safeguards are not authorization to run test suites. On unsafe state or unavailable Samsung agent, report HOLD; do not bypass guards or claim deployment.
- **Verification is not testing:** read back live/installed SHA and basic read-only status and health evidence; do not run functional tests or smoke-test routes without explicit authorization.
- A commit or queued task is not a deployed PASS. Unknown result means HOLD. No automatic retries.
- Docs-only changes: commit to Git only; **no automatic documentation checks, build or panel restart**. Preserve dependencies/caches.

## Safety

- Discovered processes/sites are external until separately verified. Never stop/change/adopt IleStoi, PhotoMap, Local Agent, SSH, Cloudflare, Mosquitto or unrelated services/data.
- Only the verified PocketHost DEV panel has its existing runit restart/rollback exception. Check PID, start ticks, cwd, source and protected services first.
- No unsolicited shell, global upgrades, WAN exposure or hidden credential logs. Private LAN DEV UI has no auth/TLS; ADB is not root.

## Product and gates

Basic = full official-Termux Hosting (H2 static separate from Node). Pro/Companion/Shizuku expansion and unified APK deferred. Host/process/permission edits need targeted positive and negative tests **only when the owner explicitly authorizes testing**; never start them in the default cycle. Source DEV ≠ G2/G3 physical release.
