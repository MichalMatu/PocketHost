# UI Agent Instructions

## Scope

Future manual-CLI-launched local dashboard. Must show discovered server details accurately with ownership markers. UI calls typed application ports.

## Forbidden

No shell execution, package installs, external service restarts or automatically opened public ports. No autostart.

## Design contract

Before changing UI read `../../docs/DESIGN_SYSTEM.md` and `../../docs/TOOLING_EVALUATION.md`. Use approved component primitives and variants; never invent one-off colors, font sizes, radii, margins or shadows within individual screens. The proposed React/Vite/TypeScript, Tailwind v4, shadcn/ui Base UI/base-nova UI, based on a reviewed ShadcnStore Vite admin shell must be validated on Termux before adoption. A missing variant is a reviewed design-system change, not a local override. Keep one desktop-first layout with native Android pinch zoom and horizontal pan; never disable zoom, duplicate the mobile UI, or intercept two-finger gestures. UI behavior must not have direct host command access.

## Gate

Accessibility, empty/error states, contrast, touch size, keyboard/focus order, browser tests and no destructive controls for external services. When installed, `@shadcn/lint` rules must reject restyling, raw colors, arbitrary values, inline styles, unknown classes and non-static classes outside reviewed exceptions. Test deliberate violations. Compare screenshots to approved mobile baselines using a **Termux-qualified** browser harness when available; otherwise mark visual QA unverified.
