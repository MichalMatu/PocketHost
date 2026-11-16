---
status: active
owner: core
last_reviewed: 2026-11-15
purpose: Smallest safe entrypoint
---

# PocketHost — minimal context

Read [AGENTS](../AGENTS.md), fresh `main` SHA and nearest scoped AGENTS.md.

**Target:** already-paired Galaxy A8 Termux only. PocketHost on S22 is retired; independent S22 production IleStoi services remain untouched.

**A8 is installed and running.** Guarded FAST FLOW returned PASS for live panel SHA **`bfd16d6362b879a41120389fe2d2e81a1a6cd8e6`**, QA on this SHA has FAIL (format only; structure/boundaries PASS; types/Node/UI SKIPPED), PID 2106/start ticks 23573375, HTTP 200; official Termux runit supervises panel/watch. Boot autostart was configured, **not reboot-tested**. The earlier `9bf224dc1b47fe9cd94be733690bb4bc137a9227` deploy HOLD rolled back safely; a subsequent owner-approved QA run at that SHA found a syntax defect. Code was fixed and released as `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6`. The one-shot QA on the fixed SHA is completed and failed changed-file format; a further formatting tool run needs fresh approval. GitHub `main` may be ahead after docs-only commits.

**Product:** dynamic runit discovery, generic Node/static workloads; Hosting APIs remain feature-gated. Trusted LAN without login is the owner's requirement; WAN exposure remains forbidden, and LAN mutation safety must be preserved. Network Access has private-interface enable/disable, while boot behaviour acceptance and configurable SSH/GitHub/health/autostart policy remain to build.

**Hard product rule:** no concrete hosted project, domain, process or special health endpoint belongs in PocketHost runtime code, UI or default configuration. All host service, LAN, autostart, health, SSH and Git/GitHub settings belong in the panel and verified service registry.

**Services IA:** Each service has a separate menu destination; the Overview only navigates. Main menu: Overview → Hosting → Services → System & Tools → Automation → Settings; Framework/CMS examples kept at the very bottom. MacBook LAN menu baseline accepted, not full-stage acceptance.

**Canonical next task:** [MVP execution tracker](MVP_EXECUTION_PLAN.md) determines task order and completion checkboxes. Finish **1. Services → 2. Platform → 3. Hosting → 4. MVP stabilization**, starting with **S1** (generic verified service enrollment). Do not build more half-finished skeletons.

**Default workflow:** [single-pass code → deploy → verify](DEV_ITERATION.md) on the paired A8, exact-SHA/owner/health readback. **Tests are OFF in every mode by default, including stage closure.** The previous general consent to stage tests is withdrawn. Run any suite, lint, typecheck, formatter, smoke or QA **only after fresh explicit confirmation** of exact scope. The FAST FLOW deployment CLI has no test flag. Independent A8 QA is a separate manual action with exact-SHA approval; never conflate deployment health with tests. Physical reboot or protected-service changes still require separate consent. Documentation-only commits do not restart or deploy. No scheduler, Mac, Codex, Work, Actions, S22 or automatic retries.

[MVP plan](MVP_EXECUTION_PLAN.md) · [Local Agent transport](LOCAL_AGENT_TERMUX.md) · [Architecture](ARCHITECTURE.md) · [Roadmap](ROADMAP.md) · [Historical A8/S22 checkpoint](checkpoints/2026-11-14-final-s22-reaudit-a8-local-agent-handoff.md).
