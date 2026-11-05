---
status: accepted
owner: ui
last_reviewed: 2026-11-05
purpose: Set an enforceable design token and component style contract for the future GUI
---

# PocketHost Design System — Pre-implementation Contract

## Selected direction

Use **React + Vite + TypeScript**, Tailwind CSS v4 and **shadcn/ui**, with **ShadcnStore Vite dashboard Base UI/base-nova** as the preferred reusable admin-shell candidate (subject to native Termux qualification), plus [`@shadcn/lint`](https://github.com/shadcn-ui/lint). This is a **design decision subject to native Termux qualification**, not installed application code. Prefer a local web/PWA dashboard opened manually by CLI, then consider a native APK wrapper later. Do not add Ubuntu, Docker, React Native or another Linux layer to build the initial UI.

The previously proposed `maia` preset is superseded in the preferred ShadcnStore route: ShadcnStore v2 uses Base UI/base-nova rather than the old Radix UI baseline. Pin a single source version, icon set, token inventory and component family after a real on-phone build. Do not mix incompatible variants or re-import unrelated demo screens. Preserve the upstream MIT notice for reused source.

## Desktop-first layout and Android pinch zoom

The owner confirmed that the imported dashboard already has a good **responsive mobile layout** and that Android **pinch zoom works correctly**. Preserve the existing adaptive sidebar, cards, tables, mobile breakpoints and touch interaction; keep the same React codebase for desktop and Android. **Do not force a desktop-only minimum width, add CSS zoom transforms or implement a second mobile GUI.** Desktop remains the primary information-dense layout on larger screens, while the current responsive phone layout and native browser zoom are both accepted. Any breakpoint or viewport change requires renewed physical-device acceptance.

**Native browser pinch zoom must remain enabled.** Do not set `user-scalable=no`, limit `maximum-scale`, suppress global two-finger gestures or scale the entire app with a brittle CSS transform. Start with `width=device-width` and validate real phone viewport behavior. Optional fit-to-width is a separate, tested user mode, not a substitute for pinch zoom. Touch, mouse, keyboard, modal scrolling, charts and tables must behave correctly at different zoom levels.

Desktop-first does not exempt mobile interaction accessibility: no invisible or clipped controls, adequate hit targets at usable zoom, reachable dialogs, readable forms and tested pan. Record Android-specific exceptions in baseline evidence.

## One token source

One DTCG-compatible JSON token inventory generates semantic CSS variables (using Style Dictionary after on-device qualification). Design tokens define:

- Semantic backgrounds, surfaces, text, borders, primary, focus, success, warning, error and info for light/dark themes.
- Typography roles (heading, body, caption, tabular/monospace), controlled font stack, weight, size and line height.
- One 4px-based spacing scale, icon sizing, border widths, radii, elevation, breakpoint and motion vocabulary.
- Component variants and states: default, loading, disabled, focused, empty, error and confirmed/success.
- An initial minimum interactive target size of **44 × 44 CSS pixels** for critical controls where practical; documented exceptions require review.
- Contrast and zoom accessibility checks against the rendered background, not assumptions about token names.

Token values and generated CSS are pinned after initial accepted GUI fixture, before any feature screen. Components use semantic token names, **not direct palette names**.

## Shared components are the only vocabulary

Screens compose from an owned `src/ui/components` registry: app header, navigation, status/health badge, service card, settings row, detail table/list, action controls, loading/empty/error states, dialog and notification. Each component has explicit variants and allowed layout props. No page-local color, padding/radius, hard-coded pixels, box shadow, class interpolation or copied ad-hoc UI snippet.

External services (including IleStoi.pl) are marked **observed/read-only**, clearly distinct from PocketHost-owned processes. Never show destructive actions for an external service; don't rely on color alone to convey ownership.

## Automated anti-drift gates

After native package acceptance, configure **ESLint + `@shadcn/lint`** at error severity for `no-restyle`, `no-raw-colors`, `no-arbitrary-values`, `no-inline-styles`, `no-unknown-classes` and `require-static-classes`. Allow only reviewed layout classes, while component internals use documented narrow overrides (never hide color/security violations). Bind error messages to the actual approved component, variant, token and this document.

Use Stylelint and token-aware CSS checks for CSS rules/variables not visible to JSX lint. Review any changes to token inventory, preset code, lint allowlists and suppression comments as design-system decisions. Create intentional negative fixtures that add forbidden `bg-red-500`, `p-[13px]`, `style={{...}}` or `className` restyling to verify gates **fail**. Avoid mass-changing baselines just to make checks green.

## Visual and interaction gates

Automated style gates **cannot** guarantee visual correctness. Capture approved deterministic screenshots from a Termux-qualified Android browser/WebView harness for narrow/wide phones, light/dark themes, long text and core loading/empty/error states. Run accessible name, focus/keyboard, screen reader/axe checks, tap-target checks, overflow and layout shifts. Pin viewport/font/rendering environment and review unexpected screenshot diffs. Without demonstrated working native browser automation, visual QA remains `pending`, not `passed`.

## Agentic UI change rules

Before editing UI, read this document, `src/ui/AGENTS.md` and current approved tokens and component inventory. Prefer an existing component/variant; if none exists, propose one **system-wide** addition with tests, documentation and baseline updates. After edits run native Termux quality gates through Local Agent and preserve negative-gate tests. Rejected styling is corrected at component or token level, not via scattered micro-fixes.

## Scope restrictions

This selection only defines a future manually-launched local GUI. It does not authorize installing Termux packages, updating IleStoi.pl, enabling device autostart, exposing the admin API publicly or creating an APK now.
