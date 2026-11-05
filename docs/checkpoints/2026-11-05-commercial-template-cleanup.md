---
status: accepted
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

## Accepted native-device evidence

- **Source SHA:** `af487e8ed51416a47db60afaa72758376147dce7` (commercial UI code before documentation-only acceptance updates), branch `sprint/p1-closeout-20261105`.
- **Termux Local Agent receipt** `pockethost-commercial-clean-ui-native-gates-20261105-v1`: **26/26 tests PASS**, full imported UI ESLint **PASS**, native Vite build **PASS**, unchanged/clean worktree, full 32-route template preserved, original MIT notice preserved, both promotional source components removed.
- **Guarded native cutover** `pockethost-commercial-clean-ui-preview-cutover-20261105-v1`: `done/exit 0`, new PocketHost DEV preview on `127.0.0.1:8787`, `/host` and `/dashboard` HTTP **200**, sanitized read-only six-service API HTTP **200**, POST **405**, foreign Origin **403**. The old PocketHost preview alone was ownership-verified and stopped, and rollback was provisioned; no IleStoi.pl process or boot config was changed.
- **Real Android Chrome acceptance** `pockethost-commercial-clean-ui-real-android-smoke-20261105-v1`: `done/exit 0`, six of six browser controls PASS: Android Chrome identified, PocketHost tab title, no floating Pro or premium upsells in rendered DOM, no ShadcnStore marketing in rendered host page, native responsive viewport preserved and live read-only host API working.
- Prior on-phone Chrome route/zoom receipt `pockethost-closeout-onphone-chrome-route-zoom-20261105-v1`: all **31 navigable** non-redirect/non-catchall page paths PASS (the original **32** demo route entries plus separate host route are preserved), native pinch zoom changed visual viewport scale **1.0 → 1.7**, screenshot capture succeeded and browser returned to `/host`. These tests did not remove or rewrite demo routes.

## Commercial and security boundaries

This is a **standalone locally hosted React dashboard**, not a licensed online CMS, and uses **no ShadcnStore account, Pro subscription, vendor API, license activation or paid UI blocks**. Original MIT notice must remain in source and be included in distributed commercial packages where legally required. The imported sign-in, registration and billing demo page **source** remains for optional later adaptation; those screens do not implement authentication or actual subscriptions for PocketHost.

The tested preview is for local development only. It is **not yet a production-secure remote admin**: do not expose the Vite development server, guest-auth forms or read-only endpoint over WAN. **Root Gate 1** is an independent remaining gate, not claimed here. No PocketHost autostart was introduced.
