# Admin Application Instructions

## Scope

The full pinned ShadcnStore Vite admin under apps/admin
is preserved with upstream routes/assets and MIT notice.
PocketHost-specific UI communicates through typed APIs,
not direct Termux process operations.

## Forbidden

Never expose the Vite backend on WAN or wildcard
interfaces. Use its dedicated loopback listener and
the already owner-approved private-LAN gateway; retain
Android pinch zoom. No unapproved external service
adoption, GitHub Actions, package installation hooks or
duplicate preview environment. The **only runit autostart
exception** is the verified PocketHost DEV admin panel,
not hosted sites or the Local Agent.

## Gate

For simple UI changes use Vite HMR and impacted tests only.
Run focused Vitest/admin typecheck/lint on Samsung Termux
through Local Agent; reserve full admin build and broad
suite for meaningful milestones or host-risk changes.
Keep upstream screens and license intact.
See [code map](../docs/CODE_MAP.md),
[fast flow](../docs/DEV_ITERATION.md) and
[design system](../docs/DESIGN_SYSTEM.md).
