---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Smallest safe entrypoint
---

# PocketHost — minimal context

Read [AGENTS](../AGENTS.md), fresh `main` SHA and nearest scoped AGENTS.md.

**Target:** already-paired Galaxy A8 Termux only. PocketHost on S22 is retired; independent S22 production IleStoi services remain untouched.

**A8 is installed and running.** Guarded cold install and three code → deploy → verify passes on 14 November 2026 returned terminal PASS. Last verified live panel SHA: **`8189e053ac54d1c029c97ebb9a9bd14bf16518e5`**, HTTP 200; official Termux runit supervises panel/watch. Boot autostart was configured, **not reboot-tested**. GitHub `main` may be ahead of live SHA after docs-only commits.

**Latest product slice:** Services now includes an owned Node/static Hosting workload view with desired/observed state and manually requested HTTP readiness. Hosting APIs remain feature-gated, not automatically activated. Unauthenticated DEV LAN mutations must be secured before enabling new Hosting actions.

**Immediate goal:** continue [M2–M5 Hosting and host-level service coordination](HANDOFF_NEXT_CHAT.md): registry/ownership, installation, lifecycle, autostart, readiness, log/rollback and SSH/Git management under explicit owner gates. Existing SSH/Local Agent remain protected; Local Agent independent task transport, not owned by panel.

**Default workflow:** [single-pass code → deploy → verify](DEV_ITERATION.md) on A8, terminal exact-SHA owner and health readback; **no tests by default** until expressly requested. Docs-only changes never restart or deploy. No new scheduler, Mac, Codex, Work, GitHub Actions, S22 changes or automatic retries.

[Local Agent transport](LOCAL_AGENT_TERMUX.md) · [Architecture](ARCHITECTURE.md) · [Roadmap](ROADMAP.md) · [Historical A8/S22 checkpoint](checkpoints/2026-11-14-final-s22-reaudit-a8-local-agent-handoff.md).
