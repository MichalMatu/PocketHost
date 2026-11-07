# PocketHost

PocketHost is an experimental Android/Termux
hosting control panel. It includes read-only
host inventory, a React admin dashboard, an
explicitly owned static demo and a stopped
PhotoMap TEST catalog. It is **not yet a
production hosting manager**.

## Status (2026-11-07)

- H2/H2.1: independent static-site hosting and
  release history accepted with physical device
  and owner browser evidence.
- H3.4: named-root File Manager, scoped package
  and runit controls, Restic backups, manual ttyd
  terminal and a local typed Agent API are
  implemented. Full native Samsung G2 and the
  guarded panel-only G3 deployment passed.
- The live trusted-LAN panel is **not** a
  production-grade authenticated management
  service. Public access and autostart remain
  prohibited. PhotoMap TEST execution is disabled.
- Hardware follow-ups remain open for Restic
  recovery, ttyd HTTP/WebSocket operation,
  real browser controls and service safety.
- The general audit adds a fail-closed Restic
  exit-status regression fix; its new source
  needs separate exact-SHA Samsung G2 acceptance.

Accepted H3.4 source: `cc9f47a1f7f71d7f6bdb715c98a226cf89c7d663`;
`npm run check:all` passed on Samsung,
including **45/45 admin UI tests**.
The guarded installed panel source is
`e1c11e723105025b0f24ecf8e70974beddc0c2b5`.
A later physical smoke reached a successful
File Manager round-trip but failed the
Restic backup stage. See the
[latest audit checkpoint](docs/checkpoints/2026-11-07-general-repository-audit-repair.md)
for precise outstanding evidence.

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
