---
status: checkpoint
owner: core
last_reviewed: 2026-11-18
purpose: Verified A8 DEV state, scoped test evidence, product maturity and unfinished acceptance
---

# PocketHost — checkpoint A8 / Hosting MVP / P1 (18 listopada 2026)

## Punkt odniesienia

- Repository: `MichalMatu/PocketHost`, branch `main`. **Actual last verified panel code**: `90b42f23a211bef180dac1f04667e75710b5b6db` (before subsequent docs-only handoff). Never infer live SHA from subsequent documentation commits.
- Executor: paired Samsung Galaxy A8 Termux Local Agent via the private `MichalMatu/local-agent:agent-control` task/result transport. Panel available only in trusted private LAN (observed `192.168.0.16:18878`); address can change.
- Last guarded DEV deployment `pockethost-a8-quality-doc-planner-90b42f2-20261119-v1`: terminal PASS, live SHA `90b42f23a211bef180dac1f04667e75710b5b6db`, owned panel PID **14715** / start ticks **45606162**, HTTP **200**, protected services unchanged; **tests not run**. Previous `81f269ad`, `8d257a03` and `a7f85e33` deployments also PASS. This does not attest hosted applications' current HTTP readiness.
- Last exact-SHA owner-approved QA `pockethost-a8-p1-logs-nav-redaction-qa-b1fde53-20261118-v1`: **PASS only for `b1fde537dd9dc1b3ef8b40e2e2eb17b7e70328b6`** against base `e966f749f346c371f3cee986e8aa4180219759ea`: UI navigation, redaction, admin TypeScript, module boundaries and code budgets. The newer `81f269a`, `8d257a0`, `a7f85e3` and `90b42f2` changes have written regressions but **no executed QA**.
- Earlier one-shot scoped QA at `263d64b`, `5cd0d80`, `e966f74`: PASS for their respective affected UI, TypeScript, module boundaries and budgets. Historical failures on older SHAs are not current-source failures unless reproduced. **Full latest-SHA repository G2 and physical G3 are NOT certified**.

## Latest scoped P1 changes (code on A8, 18 November)

- `81f269ad`: corrected superseded Termux:Boot diagnostic responses. One-shot guarded deploy PASS; test committed but not run.
- `8d257a03`: Hosting inventory Refresh can retry a stalled request; superseded responses remain abort-gated. One-shot guarded deploy PASS; test committed but not run.
- `a7f85e33`: Network Access aborts superseded LAN reads and gates stale API responses. Guarded deploy PASS; regression committed but not run.
- `90b42f2`: changed-file QA planner now treats scoped `src/**/AGENTS.md` as documentation, not missing test coverage. Prior plan was `MANUAL_REVIEW`; guarded deployment PASS, targeted planner regression written but not run.
- A8 read-only preflight `pockethost-a8-quality-live-preflight-20261119-v1` PASS. Agent queue **319 tasks / 319 terminal results, zero pending** at this checkpoint update.
- No reboot, SSH/WAN/Cloudflare, backup/restore, untrusted Node or automated QA. Services S1–S4 remain `READY_FOR_ACCEPTANCE`.

## What is working, and what the evidence proves

| Area | Implementation and verified evidence | Acceptance boundary |
| --- | --- | --- |
| A8 panel / observability | DEV runit panel, host inventory, monitoring, Dashboard and dedicated service pages; owned PID/source/HTTP readback; separate protected Local Agent. Private LAN UI screenshots reviewed. | Private-LAN DEV, not WAN/TLS-secure public panel; no physical reboot acceptance. |
| Static Hosting `/sites` | Own-site Create → publish `index.html` → Start → serve HTTP on LAN. Second version was published, served and rolled back to original content, verified by source hash on A8. UI displays release, process state/memory/uptime, uploads, logs and operations. | ZIP/folder import and broad failure cases are not separately physically certified; status `running` is not an automatic HTTP probe. |
| Trusted Node.js `/projects` | Owner token gate with denied unauthenticated mutation; owned Create → Stage → Deploy → HTTP/readiness/logs → Update → Stop/Start → Rollback physically PASS on A8 demo. Runtime/source/release and advanced options in UI. | Trusted same-Termux-UID code **not sandboxed**. No untrusted arbitrary app hosting or public access. Per-browser owner token unlock still requires owner authorization. |
| Hosting overview and operations | `/hosting`, `/deployments`, `/runtime-logs` show separate Static/Node inventories and release history, selection/deep links, bounded on-demand project logs. Unknown project links fail closed and credential-named log lines are masked; affected tests PASS at live SHA. | Visual MVP accepted; Node readiness and Static HTTP clicks plus logs switch are not signed off as current-browser functional acceptance. |
| Services S1–S4 | Owned fixed-template worker physically completed Create → Start → Health/Logs → Stop → Archive → Restore → Retire once, with ownership readbacks. Runit inventory, lifecycle, Health and manual recovery UI exist. | **READY_FOR_ACCEPTANCE, not ACCEPTED**. Generic own-script/Python execution, all negative paths, arbitrary service enrollment and reboot autostart not qualified. |
| Platform | Private LAN gateway/status, Termux/runit status, Boot inventory/desired-state diagnostics, some read-only Git and settings views. | Boot after reboot, persistence, SSH keys/config, GitHub credentials and public domain/tunnel workflows incomplete or awaiting separate authorization. |
| Backup | One scoped **encrypted local** Restic snapshot of Node-owned project root, independent restore into separate staging, 10/10 matching files and hash readback PASS. | Not full HOME/PREFIX/Static or off-device disaster recovery. Browser backup mutations disabled. Off-device Restic explicitly **DEFERRED without date**. |

Product maturity: **working private-LAN MVP / development beta for trusted owner**, with meaningful device-tested Static and Node flows. Not a production-ready public hosting platform, secure untrusted-code executor or completely accepted appliance.

## Safety constraints (still binding)

- All code/build/deploy/test/device commands through the **verified A8 Local Agent**, not Mac/S22, Work, Codex, Actions or ChatGPT sandbox. One immutable agent task; verify host, exact SHA, process owner, protected services and readback. An unknown result is HOLD, never automatic retry.
- No automatic QA, lint, typecheck, formatting or smoke; every test execution requires **fresh owner approval for scope and exact SHA**. Current targeted QA PASS does not authorize future runs. Docs-only Git edits do not deploy or restart.
- Never touch foreign services, SSH, tunnels, cloud APIs, secrets or data roots by incidental discovery. No scheduling, reboot, WAN exposure or unmanaged Node execution without distinct explicit owner decision.
- LAN panel has no login/TLS; Node owner token authorizes writes but does not isolate processes from the Termux UID. Never call `running` equal to HTTP-ready.

## Remaining work, in priority order

1. **Hosting P0 functional acceptance — DEFERRED by owner:** manually verify `Check readiness` for trusted Node, exact Static site HTTP, correct project-log switching/error behavior, then record a bounded acceptance receipt. Visual layout on `/projects`, `/deployments` and `/hosting` was accepted; it does not replace these checks.
2. **Services S1–S4 acceptance — OPEN:** confirm actual current fixed-worker controls, inventory identity/provenance, safe failures and manual recovery; user-script/Python execution remains gated. Do not restart a foreign worker.
3. **P1 stabilization — continue only from reproducible defects:** simplify stale-catalog/error handling, route/owner consistency and security controls. Existing fail-closed Node/Static refresh and uncertain Static Create paths plus bounded/redacted logs have scoped QA PASS. Do not rework accepted UX without a defect.
4. **Android autostart / Termux:Boot — OPEN, separate physical authorization:** real reboot, desired-state readback, verify independent panel/agent/hosted apps and protected services. No reboot has been performed for acceptance.
5. **Platform — INCOMPLETE/DEFERRED:** LAN persistence after reboot, SSH and Git/GitHub configuration/secret handling, authentication/TLS/WAN policy. WAN, custom domains, Cloudflare and optional Companion/Shizuku require distinct scope/security design.
6. **Hosting extension — LATER:** independently qualify ZIP/folder import, npm/build and failure recovery for general projects; before accepting any untrusted Node source implement real process/FS isolation.
7. **Backlog without date:** off-device Restic copy and independent restore; see [design-only proposal](../P1_OFF_DEVICE_RESTIC_PLAN.md). Do not run copies, transfer, restart or restore from this checkpoint.

## Evidence and resume instructions

- [Exact Hosting P0 device receipts and Node Restic proof](../MVP_INTEGRATION_CHECKLIST.md)
- [MVP tracker](../MVP_EXECUTION_PLAN.md), [roadmap](../ROADMAP.md), [quality gates](../QUALITY_GATES.md)
- [A8 Local Agent transport/runbook](../LOCAL_AGENT_TERMUX.md), [architecture](../ARCHITECTURE.md), [owner security contract](../../AGENTS.md)
- Historical checkpoints live in [the archive index](README.md); old versions of reduced active docs remain available through Git history at commit `3513e452d2d98b3615ec2305247a2eaa5deabf8c`.
- On the next task: re-read actual `main` and the independent verified A8 live source. **Docs-only HEAD may be ahead of deployed code.** Never claim an older receipt certifies changed source.
