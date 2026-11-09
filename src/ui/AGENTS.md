# UI Agent Instructions

## Scope

Browser/React presentation and typed PocketHost API clients.
Preserve original upstream admin routes, components, assets
and responsive desktop-first Android pinch zoom. Use existing
layout tokens/components before adding style variants.

## Forbidden

No direct OS or Termux shell execution inside UI code.
Owner-triggered Advanced Shell uses the **typed existing
private-LAN API and Android loopback Companion**, not a
new arbitrary host-command endpoint. Never imply Android
ADB is root, expose a public listener, automatically execute
privileged actions or modify other Termux services.
Do not introduce mandatory pairing/phone confirmation for
the already owner-approved direct DEV Shizuku shell.

## Gate

For copy/CSS, use the existing Vite HMR and owner review;
for interactive controls run affected Vitest files and
accessibility/error states. No blanket UI suite, screenshot
matrix or full build on each small edit. For changed routes,
run the admin preservation contract. Only Samsung Termux
Local Agent executes PocketHost tests or builds. Details:
[DEV flow](../../docs/DEV_ITERATION.md) and
[design system](../../docs/DESIGN_SYSTEM.md).
