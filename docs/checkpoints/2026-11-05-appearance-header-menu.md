---
status: accepted
owner: ui
last_reviewed: 2026-11-05
purpose: Consolidate theme and layout controls into the existing top-right header button
---

# Header Appearance Menu — implementation checkpoint

## Scope

Use the already accepted PocketHost responsive UI and pinch zoom unchanged. Replace only the floating 48px `ThemeCustomizerTrigger` entry with a single dropdown on the existing top-right theme icon. Menu actions: `Light`, `Dark`, `System`, `Colors & themes`, `Panel layout`, and `Reset appearance`. The two customizer tabs, preset imports and existing layouts remain implemented in the same `ThemeCustomizer` sheet.

The menu uses the already adopted Base UI dropdown; the header and layout share one controlled customizer instance. Reset restores the system color preference, default radius, the default sidebar layout and clears theme overrides. System mode listens to operating-system theme changes.

**Preserve:** all 32 upstream routes, host snapshot, no Pro upsell, MIT license, touch layout, native browser pinch zoom and loopback-only API. No host services modified.

## Native acceptance and runtime incident

- `0645ee208c449f716edca1a22d64c0731993e127` is the accepted source of the fixed menu.
- `pockethost-appearance-menugroup-fix-native-20261105-v1` returned `done/exit 0`: 31/31 foundation tests, admin ESLint and native Vite build PASS, clean worktree.
- `pockethost-menugroup-guarded-restart-20261105-v1` returned `done/exit 0`: verified PocketHost-owned process restart and HTTP 200 for host, dashboard, connections, API, updated module; POST 405 and foreign Origin 403.
- The first new menu implementation had a real Base UI runtime crash because `DropdownMenuLabel` was outside `DropdownMenuGroup`. Regression test added before restarting. The owner confirmed the repaired panel works.
- Automated Chrome CDP rerun after the fix was unavailable because ADB had no authorized Android device at that check. Earlier on-device Chrome route/zoom smoke and the user's latest manual acceptance are separate evidence, not a substitute for full E2E.
- No external process restart, production configuration change or PocketHost autostart.

## Acceptance required

- Run `npm run check:foundation`, admin `npm run lint`, `npm run build` **only on Termux** in an isolated worktree, and record exact commit/result.
- Use real Android Chrome via existing approved ADB diagnostics (if available) to check the top-right appearance menu opens, light/dark/system work, both customizer tabs open, reset works, and the floating settings trigger is absent. Do not claim browser behavior until the device receipt is published.
- Do not replace the active `127.0.0.1:8787` preview until green native gates and a guarded PocketHost-owned process switch, including rollback.
