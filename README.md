# PocketHost

PocketHost is a planned Android/Termux-based web-hosting control plane. Its first milestone is a **read-only local inventory dashboard** for an existing Termux installation; no hosting application has been implemented yet.

## Project rules

- Development starts **manually from the Termux command line**. No boot or app autostart.
- Preserve the official Termux installation and package update mechanism; no Termux fork in the initial phase.
- Do not interrupt, reconfigure, or take ownership of existing services (especially IleStoi.pl and Local Agent).
- The first inventory capability only **observes** existing processes, ports and configuration after sanitizing sensitive values.
- Local UI/API bind to loopback by default. Public management or AI deployment APIs are out of scope for the first milestone.
- No GitHub Actions, Codex, or ChatGPT Work are required for development. Validate in a local sandbox and, when available, on the actual Termux host using Local Agent.

## Start here

1. Read [project requirements](docs/PRODUCT.md) and [architecture](docs/ARCHITECTURE.md).
2. Read the root [agent instructions](AGENTS.md) and the nearest module's `AGENTS.md`.
3. Review [module boundaries](docs/MODULES.md), [quality gates](docs/QUALITY_GATES.md) and [development plan](docs/DEVELOPMENT_PLAN.md).
4. Run `npm install` and `npm run check` **when dependency download is available**. The dependency-free foundation gates can be run with `npm run check:foundation`.

No application runtime is committed at this stage. Structure and automated quality gates are established first.
