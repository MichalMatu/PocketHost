---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Compact source and QA entry map for safe feature-bounded changes
---

# Code, transport and tests

| Area | Source ownership |
| --- | --- |
| Browser routes, feature components and hooks | `apps/admin/src/app/`; no direct Termux host effects |
| Browser contracts, validation and API clients | `apps/admin/src/lib/`; interact through bounded HTTP APIs |
| Node/Vite API bridge | `apps/admin/vite.config.ts` and `apps/admin/plugins/node-project-api.ts`; server-side only |
| Portable types and domain rules | `src/shared/`; no host/process effects |
| Privileged host adapters | `src/modules/host/`; files, runit, process ownership, Local Agent and Static/Node backends |
| Pure policy / domain modules | `src/modules/runtime/`, `sites/`, `config/`, `packages/`, `observability/` |
| Registered placeholder scopes | `src/modules/ai/`, `diagnostics/`, `inventory/`, `shizuku/` |
| Guarded A8 deployment | `ops/termux/fast-flow.mjs`, `ops/termux/refresh-panel.mjs` |
| Selective QA policy and planners | `scripts/dev/verify-changed.mjs`, `scripts/dev/changed-checks.mjs` |
| Source boundaries and budgets | `scripts/quality/check-structure.mjs`, `check-boundaries.mjs`, `check-code-budgets.mjs` |
| Tests | `tests/quality/*.test.mjs` and `apps/admin/tests/*.test.tsx` |

**Real API seam:** `vite.config.ts` still composes many host-facing endpoints (pinned large legacy file); `plugins/node-project-api.ts` demonstrates a bounded server-only extraction. Extract routes incrementally; do not move host calls into browser components or make a competing worker/supervisor.

**Current source-level modularity assessment:** [module map](MODULES.md) and [22 November checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). The static gates do not exhaustively verify imports across the Vite/browser boundary. Open nearest `AGENTS.md` only, and distinguish source inspection from approved A8 QA.
