# PocketHost Documentation

**Start here:** [minimal context](START_HERE.md) (about 2.4 KB),
[root AGENTS](../AGENTS.md), then the one scoped AGENTS.md
nearest the changed code. Do not load every link listed here
into an Agent context.

## Active reference — read only what changes

- [Compact next-session handoff](HANDOFF_NEXT_CHAT.md)
- [Code and test entrypoints](CODE_MAP.md)
- [Fast DEV / selective checks](DEV_ITERATION.md)
- [Termux Local Agent contract](LOCAL_AGENT_TERMUX.md)
- [Current QA and release gates](QUALITY_GATES.md)
- [Canonical M0–M7 roadmap](ROADMAP.md)
- [Small development plan](DEVELOPMENT_PLAN.md)
- [Architecture boundaries](ARCHITECTURE.md)
- [Module dependencies](MODULES.md)
- [Target navigation and migration](TARGET_INFORMATION_ARCHITECTURE.md)

## Reference — use for a specific decision

- [Product and historical MVP scope](PRODUCT.md)
- [Termux integration](TERMUX_INTEGRATION.md)
- [Security model](SECURITY_MODEL.md)
- [Upstream/license reuse matrix](UPSTREAM_REUSE_STRATEGY.md)
- [Design system](DESIGN_SYSTEM.md)
- [Admin template/import notes](ADMIN_MVP.md)
- [Tooling evaluation](TOOLING_EVALUATION.md)

## Module specifications

- [Host](modules/host.md)
- [Sites](modules/sites.md)
- [Runtime](modules/runtime.md)
- [Packages](modules/packages.md)
- [Configuration](modules/config.md)
- [Observability](modules/observability.md)
- [Diagnostics](modules/diagnostics.md)
- [Inventory](modules/inventory.md)
- [Shizuku](modules/shizuku.md)
- [AI API](modules/ai.md)

## Decisions and history

ADRs record the decision at its date; a newer owner-approved ADR
can supersede older initial-MVP scope without changing historic
evidence. The active constraints live in root AGENTS.md.

- [ADR-0001 foundation](adr/0001-foundation.md)
- [ADR-0002 upstream Termux](adr/0002-upstream-termux.md)
- [ADR-0003 Local Agent](adr/0003-termux-local-agent-execution.md)
- [ADR-0004 UI design](adr/0004-ui-design-system-quality.md)
- [ADR-0005 admin shell](adr/0005-desktop-first-admin-shell.md)
- [ADR-0006 private LAN](adr/0006-private-lan-access.md)
- [ADR-0007 PhotoMap layout](adr/0007-photomap-managed-instance-layout.md)
- [ADR-0008 PhotoMap catalog](adr/0008-photomap-p4-managed-catalog.md)
- [ADR-0009 PhotoMap runtime](adr/0009-photomap-isolated-runtime.md)
- [ADR-0010 Observability](adr/0010-read-only-observability.md)
- [ADR-0011 H3.4 Termux administration](adr/0011-h34-termux-administration.md)
- [ADR-0012 private UI fast review](adr/0012-private-ui-rapid-review.md)
- [ADR-0013 Shizuku power user](adr/0013-shizuku-power-user.md)
- [ADR-0014 PocketHost-only runit](adr/0014-termux-panel-supervision.md)

[Checkpoint archive](checkpoints/README.md) preserves exact-SHA
historical device evidence. Open a specific checkpoint by need,
**not** every archived note during session startup. The former
chronological front-page status list is intentionally retired.
