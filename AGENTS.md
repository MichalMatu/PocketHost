# PocketHost — mandatory agent rules

## P0 OWNER DIRECTION — TRUSTED PRIVATE LAN; SECURITY LATER (2026-11-20)

The owner treats the existing private LAN and this DEV panel as a trusted
environment. **Do not initiate security work without an explicit request.**
Authentication, tokens, protective proxy/tunnel changes, new log filtering
or redaction, access-control UI and security audits belong to a **separate
future sprint**. Do not make them a prerequisite for finishing the requested
Local Agent UI or divert the current functional sprint into security.

**Live Agent Console acceptance:** show the real source log as-is, just like
`tail -f` on MacBook: full original lines with original timestamps/order,
without semantic rewrites, SHA-only entries, character-count stand-ins,
classifier labels or silent omission. Implement the straightforward private-LAN
view requested by the owner. Acknowledge when the A8 source itself does not
yet log enough detail; fix the real emitter instead of inventing summaries.
Do not introduce new auth-token files or security architecture for this task.

Continue respecting the pre-existing restrictions on external/public network
exposure, unrelated services, recovery, and independent A8 updates; defer
optional hardening, do not silently enable WAN access.

## Entry

Read this file, [START_HERE](docs/START_HERE.md), the [MVP tracker](docs/MVP_EXECUTION_PLAN.md) and only the nearest scoped `AGENTS.md`. Current delivery and module evidence lives in the [22 November source checkpoint](docs/checkpoints/2026-11-22-source-modules-documentation-checkpoint.md); [21 November A8 evidence](docs/checkpoints/2026-11-21-pocket-host-mvp-handoff.md) and [18 November evidence](docs/checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md) and older checkpoints are historical, not the execution baseline. Always read fresh `main` and independently verified A8 live SHA.

## Execution

- **Only paired Samsung Galaxy A8 official Termux Local Agent** may run builds, deployments, device operations and source/unit/UI QA. Narrow owner-requested exception: the verified MacBook Local Agent may run the isolated `scripts/test-lab` for read-only browser screenshots, geometry and allowlisted GET API diagnostics under standing owner QA consent, with an exact source SHA and a recorded allowlisted read-only route/API scope. Mac may not deploy, build, run project QA suites, mutate API settings or control A8 services. GitHub Connector is source and immutable task/result transport (`MichalMatu/local-agent:agent-control`). Never Mac outside the narrow Test Lab exception, S22, Codex, Work, ChatGPT sandbox, GitHub Actions or schedulers.
- One coherent code change on `main` → one guarded A8 DEV `code → deploy → verify` task → terminal exact-SHA, owned PID/start ticks, unchanged protected services and basic HTTP readback. Preflight must verify clean checkout, source ownership and rollback eligibility. Unknown result or guard failure = **HOLD**, not a retry.
- **STANDING OWNER QA CONSENT — all future PocketHost sprints (2026-11-22, until explicitly revoked).** The owner expressly authorized necessary non-destructive QA, tests, lint, formatting, typechecks, builds and guarded DEV deployment, including autonomous work while unavailable/asleep. **Do not ask again for approval per sprint, test, category or SHA.** Choose the smallest relevant verification categories and derive the **exact current 40-character SHA** yourself; pass both to the separate A8 `verify-changed.mjs --base=<verified-ancestor> --execute --approved-head=<exact-SHA> --approved-checks=<selected-categories>` gate. These arguments remain mandatory source/scope integrity checks, **not** new questions to the owner. Record chosen categories and receipts. `fast-flow.mjs` never runs tests (`--tests` is unsupported); targeted A8 QA is a separate task. No scheduled/recurring jobs, redundant test loops or automatic retry of unknown tasks. After a terminal QA failure, one narrow A8-only diagnostic reproduction (exact SHA, selected test name, read-only fixture, no deployment) is allowed to recover actionable failure details; this is diagnostic evidence, **not** QA PASS. The standing consent does **not** authorize real customer-data changes, destructive/physical tests, reboots, foreign services, public/WAN/DNS/Cloudflare operations, off-device transfer or independent Local Agent upgrades: those still need distinct scoped approval.
- Required deployment readback (owner/live SHA/PID/HTTP/protected services) is operational verification, **not functional QA**. A queue commit is not deployment PASS. A **standalone Mac Test Lab tooling-only source change**, which does not modify the panel runtime, does not warrant an unrelated A8 panel restart; it remains unvalidated until separately approved lab QA. Docs-only changes: Git commit only, **no build, test, formatting or panel restart**.

## Safety

- Discovered processes, services, applications and user files are **external until verified owned**; never stop, adopt, edit or recover protected/foreign services. Local Agent and SSH/tunnels are independent protected surfaces.
- Hosted Node code shares the Termux UID and is **not sandboxed**; trusted owner-reviewed code only. Node writes require the verified owner token. Unknown/stale catalog, unsafe path/symlink, missing authorization or failed readback must fail closed.
- DEV panel is unauthenticated HTTP restricted to **trusted private LAN**, never WAN or a public proxy by default. No exposed credentials, unsolicited shell, SSH/WAN changes, package upgrades, reboot, physical destructive tests, backups or off-device transfer without distinct scope-specific approval.
- Runit is the only process supervisor; do not add a competing watchdog, cron or scheduler. Preserve independent access to Services overview, Runit, Autostart, Hosting, Health, Local Agent, SSH and related subpages.

## Product / acceptance

- Basic: generic Termux host/platform management, independent Static and Node Hosting; no named hosted customer app or hardcoded project.
- Pro/Companion/Shizuku, public hosting and untrusted-source isolation are deferred. Delivery stage `READY_FOR_ACCEPTANCE` is not `ACCEPTED`.
- Static + trusted Node device flows and scoped P1 QA are proven **only within recorded scopes**. Hosting P0 functional acceptance, full-repo G2, Android reboot G3, Services S1–S4 owner acceptance and off-device recovery remain unaccepted/deferred as marked in the checkpoint.
