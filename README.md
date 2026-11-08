# PocketHost

PocketHost is an experimental **DEV Termux management panel**
with hosting as one module. It includes a React admin UI,
system monitoring, filesystem, packages, services and
explicitly owned static sites. It is **not a public or
customer production hosting service**.

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

## Current DEV work mode (2026-11-08)

Small change -> commit to `main` -> focused test if relevant ->
Vite HMR / restart **only the PocketHost DEV panel** -> owner review.
There is **no mandatory full audit or build for each small UX change**.
Full checks run at milestone closeout or for high-risk host changes.
Use `npm run dev:quick`, optional `npm run dev:ui -- <test-file>`,
`npm run dev:panel` for manual start, and `npm run dev:full` for
closeout. See [DEV runbook](docs/DEV_ITERATION.md) and
[ADR-0012](docs/adr/0012-private-ui-rapid-review.md).

A PocketHost-only restart has standing owner approval, provided process
ownership is verified. Other Termux services, sites, LAN security and
data remain protected. No second preview environment is required.

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
