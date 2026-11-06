# PocketHost Documentation Index

## Foundation

- [Product and MVP boundary](PRODUCT.md)
- [System architecture](ARCHITECTURE.md)
- [Module dependency contracts](MODULES.md)
- [Termux Local Agent execution and fast start](LOCAL_AGENT_TERMUX.md)
- [Termux integration and host discovery](TERMUX_INTEGRATION.md)
- [Security model](SECURITY_MODEL.md)
- [Quality gates](QUALITY_GATES.md)
- [Agentic tooling evaluation and Termux compatibility](TOOLING_EVALUATION.md)
- [Design-system and UI consistency contract](DESIGN_SYSTEM.md)
- [Desktop-first admin shell and CMS decision](adr/0005-desktop-first-admin-shell.md)
- [Admin shell MVP import, build and manual start](ADMIN_MVP.md)
- [Development plan](DEVELOPMENT_PLAN.md)
- [Next-chat handoff: PhotoMap runtime](HANDOFF_NEXT_CHAT.md)

## Modules

- [Inventory](modules/inventory.md)
- [Host adapter](modules/host.md)
- [Runtime](modules/runtime.md)
- [Packages](modules/packages.md)
- [Sites](modules/sites.md)
- [Configuration](modules/config.md)
- [Diagnostics](modules/diagnostics.md)
- [AI API](modules/ai.md)

## Architectural decisions

- [ADR-0001: Foundation and no-autostart](adr/0001-foundation.md)
- [ADR-0002: Keep Termux upstream](adr/0002-upstream-termux.md)
- [ADR-0003: Termux Local Agent only](adr/0003-termux-local-agent-execution.md)
- [ADR-0004: GUI design system and anti-drift gates](adr/0004-ui-design-system-quality.md)
- [ADR-0005: Desktop-first admin shell, CMS deferred](adr/0005-desktop-first-admin-shell.md)
- [ADR-0006: Opt-in private LAN access](adr/0006-private-lan-access.md)
- [ADR-0007: Stopped managed PhotoMap instance layout](adr/0007-photomap-managed-instance-layout.md)
- [ADR-0008: P4 read-only managed PhotoMap catalog](adr/0008-photomap-p4-managed-catalog.md)
- [ADR-0009: Versioned isolated PhotoMap runtime proposal](adr/0009-photomap-isolated-runtime.md)

## Historical execution evidence

- [Checkpoint archive (read only when needed)](checkpoints/README.md)

The active entrypoints are the handoff, architecture, development plan and quality gates. Historical receipts remain available through the archive; do not load or regenerate every checkpoint during routine work.
