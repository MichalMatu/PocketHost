---
status: in-progress
owner: ui
last_reviewed: 2026-11-05
purpose: Consolidate theme and layout controls into the existing top-right header button
---

# Header Appearance Menu — implementation checkpoint

## Scope

Use the already accepted PocketHost responsive UI and pinch zoom unchanged. Replace only the floating 48px `ThemeCustomizerTrigger` entry with a single dropdown on the existing top-right theme icon. Menu actions: `Light`, `Dark`, `System`, `Colors & themes`, `Panel layout`, and `Reset appearance`. The two customizer tabs, preset imports and existing layouts remain implemented in the same `ThemeCustomizer` sheet.

The menu uses the already adopted Base UI dropdown; the header and layout share one controlled customizer instance. Reset restores the system color preference, default radius, the default sidebar layout and clears theme overrides. System mode listens to operating-system theme changes.

**Preserve:** all 32 upstream routes, host snapshot, no Pro upsell, MIT license, touch layout, native browser pinch zoom and loopback-only API. No host services modified.

## Acceptance required

- Run `npm run check:foundation`, admin `npm run lint`, `npm run build` **only on Termux** in an isolated worktree, and record exact commit/result.
- Use real Android Chrome via existing approved ADB diagnostics (if available) to check the top-right appearance menu opens, light/dark/system work, both customizer tabs open, reset works, and the floating settings trigger is absent. Do not claim browser behavior until the device receipt is published.
- Do not replace the active `127.0.0.1:8787` preview until green native gates and a guarded PocketHost-owned process switch, including rollback.
