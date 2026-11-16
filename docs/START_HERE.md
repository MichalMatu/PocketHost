---
status: active
owner: core
last_reviewed: 2026-11-15
purpose: Smallest safe entrypoint
---

# PocketHost — minimal context

Read [AGENTS](../AGENTS.md), fresh `main` SHA and nearest scoped AGENTS.md.

**Target:** already-paired Galaxy A8 Termux only. PocketHost on S22 is retired; independent S22 production IleStoi services remain untouched.

**A8 is installed and running.** Latest guarded live PocketHost DEV source
`57a718a0fc53a1dd9cf481036275e6b7627047fc`: FAST FLOW **PASS**, HTTP 200, PID **31533**,
protected services unchanged; immutable receipt
`pockethost-a8-hosting-html-starter-fast-flow-20261116-v1`.
One fixed-template worker completed the physical S1–S4 lifecycle PASS,
but custom code, reboot/Termux:Boot and generic HTTP readiness remain
unaccepted. Platform status, static Hosting creation readback, exact-release HTTP
content gates and Restic receipt guards are deployed, **not fully functionally accepted**. The older
S4 scoped **7/7 QA PASS** at `c0bf02184c804d93fca7a50cddbdd9b1146ee2c8`
does **not** validate this newer live SHA. Tests remain OFF without fresh
explicit consent. No automatic scheduler, SSH/WAN change or reboot.

**Product:** dynamic runit discovery, generic Node/static workloads; Hosting APIs remain feature-gated. Trusted LAN without login is the owner's requirement; WAN exposure remains forbidden, and LAN mutation safety must be preserved. Network Access has private-interface enable/disable, while boot behaviour acceptance and configurable SSH/GitHub/health/autostart policy remain to build.

**Hard product rule:** no concrete hosted project, domain, process or special health endpoint belongs in PocketHost runtime code, UI or default configuration. All host service, LAN, autostart, health, SSH and Git/GitHub settings belong in the panel and verified service registry.

**Services IA:** Each service has a separate menu destination; the Overview only navigates. Main menu: Overview → Hosting → Services → System & Tools → Automation → Settings; Framework/CMS examples kept at the very bottom. MacBook LAN menu baseline accepted, not full-stage acceptance.

**Canonical active task:** [MVP execution tracker](MVP_EXECUTION_PLAN.md): **Hosting**. Services fixed-template implementation has been frozen at READY_FOR_ACCEPTANCE, with full user/physical acceptance deferred. Platform and Boot gaps remain tracked but do not block the owner's requested Hosting sprint. First finish a real static-site publish/readback/rollback flow, then Node.js backend source/release/runtime and secure LAN publication. Do not return to speculative Services micro-hardening, rebuild unrelated infrastructure or enable a scheduler.

**Default workflow:** [single-pass code → deploy → verify](DEV_ITERATION.md) on the paired A8, exact-SHA/owner/health readback. **Tests are OFF in every mode by default, including stage closure.** The previous general consent to stage tests is withdrawn. Run any suite, lint, typecheck, formatter, smoke or QA **only after fresh explicit confirmation** of exact scope. The FAST FLOW deployment CLI has no test flag. Independent A8 QA is a separate manual action with exact-SHA approval; never conflate deployment health with tests. Physical reboot or protected-service changes still require separate consent. Documentation-only commits do not restart or deploy. No scheduler, Mac, Codex, Work, Actions, S22 or automatic retries.

[MVP plan](MVP_EXECUTION_PLAN.md) · [Local Agent transport](LOCAL_AGENT_TERMUX.md) · [Architecture](ARCHITECTURE.md) · [Roadmap](ROADMAP.md) · [Historical A8/S22 checkpoint](checkpoints/2026-11-14-final-s22-reaudit-a8-local-agent-handoff.md).
