# PocketHost — mandatory agent rules

## Entry

Read this file, docs/START_HERE.md, **docs/MVP_EXECUTION_PLAN.md** and only the nearest scoped AGENTS.md; use fresh main HEAD. The MVP tracker governs task order, status and acceptance; no preload of historical checkpoints.

## Execution

- Main only. GitHub Connector is source/task transport; **only verified Samsung Termux Local Agent** runs builds, device actions and any owner-authorized tests. Never Mac, ChatGPT sandbox, Codex, Work or GitHub Actions.
- Default workflow, in **one agent task**: **code → deploy → verify**. Commit the change, perform the permitted guarded update of the verified PocketHost-owned DEV panel, then read back the running revision, process ownership and basic health. Report one terminal exact-SHA deployment receipt. Do not split these stages into multiple jobs or duplicate an existing job.
- **No tests in ordinary implementation iterations.** On 2026-11-14 the owner explicitly authorized **focused positive/negative, UI/API/host and regression tests when a complete stage in docs/MVP_EXECUTION_PLAN.md is ready to close**. Use the pinned A8 FAST FLOW `--tests` gate, report actual results and gaps, then present the refreshed panel for acceptance. Do not repeat test suites for partial changes or run them implicitly. A stage-test authorization is not approval for physical reboot, SSH/external service mutations, WAN or disruptive operations; request distinct consent.
- Deployment safety checks remain mandatory: establish process ownership, live revision, protected-service isolation and rollback eligibility before updating. These operational safeguards are not authorization to run test suites. On unsafe state or unavailable Samsung agent, report HOLD; do not bypass guards or claim deployment.
- **Verification is not testing:** read back live/installed SHA and basic read-only status and health evidence; do not run functional tests or smoke-test routes without explicit authorization.
- A commit or queued task is not a deployed PASS. Unknown result means HOLD. No automatic retries.
- Docs-only changes: commit to Git only; **no automatic documentation checks, build or panel restart**. Preserve dependencies/caches.

## Safety

- Discovered processes/sites are external until separately verified. Never stop/change/adopt unrelated hosted projects, third-party services, the independent Local Agent, SSH, tunnels, brokers or unrelated data without verified enrollment.
- Only the verified PocketHost DEV panel has its existing runit restart/rollback exception. Check PID, start ticks, cwd, source and protected services first.
- No unsolicited shell, global upgrades, WAN exposure or hidden credential logs. Private LAN DEV UI has no auth/TLS; ADB is not root.

## Product and gates

Basic = universal official-Termux Hosting (H2 static separate from Node), without any hardcoded hosted project/domain/service. Panel-owned settings cover trusted LAN without login (never WAN), runit/Termux:Boot autostart, per-service health/recovery and SSH/Git/GitHub configuration; implement them with strict host/ownership gates, not hidden per-project scripts. Pro/Companion/Shizuku expansion and unified APK deferred. Host/process/permission edits require targeted positive and negative tests at their **completed-stage close-out gate**, as now explicitly authorized; never start them in the ordinary iteration cycle. Source DEV ≠ G2/G3 physical release.

## Services interface rule

Services must remain independently navigable from the sidebar: overview only links
to dedicated Runit lifecycle, Autostart, Hosting, Health, Local Agent, SSH and other
service-specific pages. No single page should load or control the entire stack.
The same backend owner and fail-closed safety gates apply in every subpage.

## Current Samsung target (A8 installed)

The owner retired PocketHost on S22. **Only use the already-paired Galaxy A8 Local Agent for PocketHost execution.** A8 cold bootstrap and seven guarded FAST FLOW updates returned terminal PASS on 14 November 2026; latest verified live SHA is `328f13191416fe5ba8d95a2cc12ccc306a77260d`. GitHub `main` may be newer than live after docs-only commits. Get exact installation identity and latest live SHA from the private A8 task/result, never infer from S22 or Git history. The owned panel/watch and global Termux runit are installed; boot autostart is configured but not reboot-verified. **PocketHost is the intended host-wide service coordinator** with verified enrollment, ownership, lifecycle, readiness, autostart, logs and recovery; do not silently adopt existing SSH/Local Agent or foreign services. No standing background scheduler, default tests during implementation, or S22 changes. See [active handoff](docs/HANDOFF_NEXT_CHAT.md).

## MVP stage acceptance

Follow [the canonical plan and tracker](docs/MVP_EXECUTION_PLAN.md) in order: Services → Platform → Hosting → stabilization. Each completed stage needs the authorized A8-focused test suite, positive/negative ownership checks, exact-SHA terminal deployment receipt, read-only HTTP/LAN evidence, concise owner report and explicit acceptance. READY_FOR_ACCEPTANCE is not ACCEPTED. Check off only proven work. Docs-only changes never restart the panel.
