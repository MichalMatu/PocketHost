---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Smallest safe entrypoint
---

# PocketHost — minimal context

Read [AGENTS](../AGENTS.md), fresh `main` SHA and nearest scoped AGENTS.md.

**Target:** already-paired Galaxy A8 Termux only. PocketHost on S22 is retired; independent S22 production IleStoi services remain untouched.

**A8 is installed and running.** Guarded cold install and multiple code → deploy → verify passes on 14 November 2026 returned terminal PASS. Last verified live panel SHA: **`0047af4a455c799086cc5f708b6add8d60462e56`**, HTTP 200; official Termux runit supervises panel/watch. Boot autostart was configured, **not reboot-tested**. GitHub `main` may be ahead of live SHA after docs-only commits.

**Latest product slice:** removed hardcoded app-specific pages/APIs and switched host snapshot to dynamic runit discovery. Services retains generic Node/static Hosting workloads. Hosting APIs remain feature-gated. Trusted LAN without login is the owner's requirement; WAN exposure remains forbidden, and LAN mutation safety must be preserved. Network Access has private-interface enable/disable, while boot behaviour acceptance and configurable SSH/GitHub/health/autostart policy remain to build.

**Hard product rule:** no concrete hosted project, domain, process or special health endpoint belongs in PocketHost runtime code, UI or default configuration. All host service, LAN, autostart, health, SSH and Git/GitHub settings belong in the panel and verified service registry.

**Services IA:** Each service has a separate menu destination; the Overview only navigates. Main menu: Overview → Hosting → Services → System & Tools → Automation → Settings; Framework/CMS examples kept at the very bottom. User opened the Wi-Fi LAN panel on MacBook and accepted the menu on 2026-11-14. That is a verified baseline, not full-stage test acceptance.

**Canonical next task:** [MVP execution tracker](MVP_EXECUTION_PLAN.md) determines task order and completion checkboxes. Finish **1. Services → 2. Platform → 3. Hosting → 4. MVP stabilization**, starting with **S1** (generic verified service enrollment). Do not build more half-finished skeletons.

**Default workflow:** [single-pass code → deploy → verify](DEV_ITERATION.md) on the paired A8, exact-SHA/owner/health readback. No test suites for incomplete development slices. The owner **explicitly authorized focused tests after each fully implemented stage**, followed by a report, refreshed A8 panel and MacBook handoff for acceptance. Physical reboot or protected-service changes still require separate consent. Documentation-only commits do not restart or deploy. No scheduler, Mac, Codex, Work, Actions, S22 or automatic retries.

[MVP plan](MVP_EXECUTION_PLAN.md) · [Local Agent transport](LOCAL_AGENT_TERMUX.md) · [Architecture](ARCHITECTURE.md) · [Roadmap](ROADMAP.md) · [Historical A8/S22 checkpoint](checkpoints/2026-11-14-final-s22-reaudit-a8-local-agent-handoff.md).
