---
status: accepted
owner: ui
last_reviewed: 2026-11-05
purpose: Record the GUI and drift-prevention tooling architecture decision
---

# ADR-0004: GUI design system and agentic anti-drift gates

## Context

AI-written interfaces drift when each screen invents new colors, dimensions, components and custom CSS. PocketHost must be cohesive before feature work, while all tests/builds remain on the Termux phone via its existing host-command Agent.

## Decision

Choose React/Vite/TypeScript, Tailwind v4, shadcn/ui with a single pinned component style; the earlier maia proposal is superseded for the preferred Base UI/base-nova ShadcnStore shell by ADR-0005, versioned semantic design tokens, Style Dictionary token compilation, and `@shadcn/lint` enforced through ESLint. Add CSS token lint, negative tests, responsive/a11y checks and **real** on-phone screenshot baselines after a supported browser harness is established. Tools remain **proposed pending Termux qualification**, not installed, tested or accepted. OpenVisio is optional code-intelligence tooling and must not block MVP or require project binding.

## Consequences

One visual vocabulary and machine-readable styling rules limit repeated page-level cosmetic corrections. Changes to tokens, variants and lint exceptions require review. A style gate does not certify real UI rendering; browser tests remain separately gated. See [design system](../DESIGN_SYSTEM.md) and [tooling evaluation](../TOOLING_EVALUATION.md).
