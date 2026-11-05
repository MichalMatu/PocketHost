---
status: implementation
owner: ui
last_reviewed: 2026-11-05
purpose: Remove commercial upsells and upstream account framing without losing the MIT template
---

# PocketHost commercial ownership and UI cleanup

## Owner acceptance

- Existing desktop/mobile responsive layout and native Android pinch zoom are **accepted by owner**; do not regress.
- Use the full MIT ShadcnStore Vite template as the app's **locally owned frontend source**, not as a hosted CMS or third-party account service.
- No provider account, activation, subscription or external vendor account required for PocketHost.
- Do not delete the 32 archived demo routes, even where they contain example sign-in/billing UI to repurpose later.

## Source change

The root layout no longer mounts the upstream `UpgradeToProButton`. The primary sidebar no longer renders a ShadcnStore promotional notification or a fake user dropdown. The header no longer links to premium blocks or the upstream repository. Brand labels, footer and tab metadata now use PocketHost. All the original demo routes remain registered and navigable. Existing CSS and viewport zoom settings are unchanged.

**Legal:** the imported source is covered by `apps/admin/LICENSE.upstream.md` (MIT, ShadcnStore 2025), permitting commercial use and modification while preserving notice. The provider's paid products follow separate terms and are **not used**. This checkpoint is a project usage note, not legal advice.

## Gate

Source branch `sprint/p1-closeout-20261105`. Dedicated tests assert the absence of upsells and vendor identity in rendered shell and preservation of the original MIT notice. Native Termux lint/build and actual Chrome recheck are required before calling this UI change *deployed*. Full root Gate 1 is tracked separately.
