# PocketHost

PocketHost is a planned Android/Termux-based web-hosting control plane. Its first milestone is a **read-only local inventory dashboard** for an existing Termux installation; no hosting application has been implemented yet.

## Project rules

- Development starts **manually from the Termux command line**. No boot or app autostart.
- Preserve the official Termux installation and package update mechanism; no Termux fork in the initial phase.
- Do not interrupt, reconfigure, or take ownership of existing services (especially IleStoi.pl and Local Agent).
- The first inventory capability only **observes** existing processes, ports and configuration after sanitizing sensitive values.
- Local UI/API bind to loopback by default. Public management or AI deployment APIs are out of scope for the first milestone.
- All PocketHost dependency installation, development commands, testing and compilation run on the **Termux phone via the exact selected Local Agent installation**. The host-command lane needs no PocketHost project binding; ordinary Git provides the checkout. Do not substitute a Linux sandbox, Mac, GitHub Actions, Codex or ChatGPT Work.

## Start here

1. Read the [Termux Local Agent fast-start/runbook](docs/LOCAL_AGENT_TERMUX.md), [project requirements](docs/PRODUCT.md) and [architecture](docs/ARCHITECTURE.md).
2. Read the root [agent instructions](AGENTS.md) and the nearest module's `AGENTS.md`.
3. Review [module boundaries](docs/MODULES.md), [quality gates](docs/QUALITY_GATES.md), [UI design system](docs/DESIGN_SYSTEM.md), [tooling recommendations](docs/TOOLING_EVALUATION.md) and [development plan](docs/DEVELOPMENT_PLAN.md).
4. Via the verified Termux Local Agent and an isolated project checkout, run `npm run check:foundation`, then resolve and lock dependencies before running `npm run check`. Do not treat configured tools or historical sandbox results as a current device pass.

No application runtime is committed at this stage. Structure and automated quality gates are established first.
