---
status: accepted
owner: ui
last_reviewed: 2026-11-05
purpose: Set an enforceable design token and component style contract for the future GUI
---

# PocketHost Design System — Pre-implementation Contract

## Selected direction

Use **React + Vite + TypeScript**, Tailwind CSS v4 and **shadcn/ui** with a fixed **`maia`** preset, plus [`@shadcn/lint`](https://github.com/shadcn-ui/lint). This is a **design decision subject to native Termux qualification**, not installed application code. Prefer a local web/PWA dashboard opened manually by CLI, then consider a native APK wrapper later. Do not add Ubuntu, Docker, React Native or another Linux layer to build the initial UI.

Upstream shadcn source lists `maia` as a supported named preset; a precise theme/base/color/font/radius/icon configuration must be resolved once and pinned in source. Never silently regenerate a different preset during agent iterations.

## One token source

One DTCG-compatible JSON token inventory generates semantic CSS variables (using Style Dictionary after on-device qualification). Design tokens define:

- Semantic backgrounds, surfaces, text, borders, primary, focus, success, warning, error and info for light/dark themes.
- Typography roles (heading, body, caption, tabular/monospace), controlled font stack, weight, size and line height.
- One 4px-based spacing scale, icon sizing, border widths, radii, elevation, breakpoint and motion vocabulary.
- Component variants and states: default, loading, disabled, focused, empty, error and confirmed/success.
- A phone-first minimum interactive target size of **44 × 44 CSS pixels** as initial product rule; documented justified exceptions require review.
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
