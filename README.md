# PocketHost

PocketHost is an experimental Android/Termux
hosting control panel. It includes read-only
host inventory, a React admin dashboard, an
explicitly owned static demo and a stopped
PhotoMap TEST catalog. It is **not yet a
production hosting manager**.

## Status (2026-11-07)

- P0-P2: read-only inventory and admin baseline.
- P3: owned HTTP Publish/Rollback/Stop/Start
  passed on Samsung; real browser interactions HOLD.
- Generic runtime: process safety source tested;
  PRoot orphan recovery on hardware remains HOLD.
- P4 PhotoMap: stopped read-only catalog accepted;
  live execution is disabled.
- O1 Observability: roadmap and module shell
  registered; metrics history and new dashboard
  are **planned, not yet implemented**.
- Package upgrades, public AI API and autostart:
  deferred and not authorized.

Last verified application source:
`bc5e5539ca4656e59077335b71c0875f967ea859`.
Samsung reported **101/101 Node**, **16/16
Vitest**, complete `check:all` PASS and
80.34% line coverage. A separate owned P3
live API cycle passed with six protected
external services unchanged.

## Development rules

Use only fresh `main`, GitHub Connector and
the precisely verified Samsung Termux Local
Agent for PocketHost code execution, tests
and compilation. No GitHub Actions, Codex,
Work, Mac/Linux fallback, new branches or
force push. Never adopt or signal external
processes or modify IleStoi.pl, original
PhotoMap, Local Agent or foreign services.
No unapproved package installs/upgrades,
autostart, public command access or
automatic recovery.

## Continue

Read [root rules](AGENTS.md),
[handoff](docs/HANDOFF_NEXT_CHAT.md),
[O1 roadmap](docs/ROADMAP.md),
[architecture](docs/ARCHITECTURE.md),
[quality gates](docs/QUALITY_GATES.md) and
[Termux runbook](docs/LOCAL_AGENT_TERMUX.md).
Historical evidence is in the
[final QA checkpoint](docs/checkpoints/2026-11-07-final-native-qa-handoff.md).
