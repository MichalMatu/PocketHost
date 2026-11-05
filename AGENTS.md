# PocketHost Agent Instructions

## Scope

Applies to the entire repository. More specific `AGENTS.md` files refine these rules, but may not weaken safety constraints. Begin by reading `docs/README.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, and `docs/QUALITY_GATES.md`.

## Non-negotiable safety

- Never modify, restart, stop, rebind, expose, migrate, or replace existing Termux services including IleStoi.pl and Local Agent without an explicitly authorized operation for the specific target.
- Treat every discovered website or process as **externally owned** until PocketHost has an explicit ownership record; discovery is read-only.
- No new listening interface except `127.0.0.1` during foundation/MVP inspection. Never publish administration endpoints, access tokens or secrets.
- No host-level filesystem scan outside agreed locations; no automatic package installation, tunnel creation, DNS modification, or process killing.
- Development is manual from CLI: do not add autostart, boot receivers, persistent services or scheduled tasks in DEV.
- Do not invoke GitHub Actions, Codex, or ChatGPT Work. GitHub Connector is for repository edits and private task transport. **All PocketHost development command execution, dependency installation, checks, tests, builds and compilation take place exclusively on the specifically addressed Termux phone through its installed Local Agent**. Do not run development commands on Mac or in a ChatGPT Linux sandbox. See `docs/LOCAL_AGENT_TERMUX.md`.
- No application feature code until foundation documentation, boundary rules and gates pass.

## Agent execution handoff

At the start of a new session read `docs/LOCAL_AGENT_TERMUX.md`; select the **exact** Termux host and installation from fresh private control evidence, not a guessed or historic ID. The current Termux Local Agent profile is host-command oriented: do not assume automatic project checkout, a repository worker, or tool availability. Use an isolated PocketHost checkout; never reuse IleStoi.pl or Local Agent directories. PocketHost itself starts only by an explicit Termux CLI command in DEV, not by device boot or Local Agent startup. Do not infer a successful run from a task publication alone.

## Architecture contract

Keep UI, discovery, service lifecycle, package installation, sites, config, diagnostics and future AI API independent, communicating through explicit typed interfaces. No module imports another module's internals or shells out independently; host commands belong behind the host adapter. See `docs/MODULES.md`.

## Changes and evidence

Every change: identify owner module, update its docs/ADR as needed, arrange `npm run check:foundation` and (when dependencies are available) full `npm run check` **via the Termux Local Agent**. Record exact on-device commands, checkout SHA, exit codes, and the returned task-result ID. Documentation-only GitHub commits may precede runtime verification, but remain **unverified** until an actual Termux result is received. Record what was tested and what could not be tested. Do not claim physical Termux validation without real evidence. Never commit secrets, host paths that reveal private data, or production configuration.

## Gate

No merge or release with failing structure/documentation/tests gates; any exception requires a documented decision in `docs/adr/` and an explicit review. See `docs/QUALITY_GATES.md`.
