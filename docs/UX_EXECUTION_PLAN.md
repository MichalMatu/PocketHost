---
status: active
owner: product
last_reviewed: 2026-11-25
purpose: Detailed UX sprint acceptance checklist
---

# PocketHost UX execution plan

## Current priority

The owner approved the UX audit and reprioritized the development queue. Retain React, TypeScript, shadcn/ui, Tailwind and Lucide; no framework migration, new hosting features or security sprint. UX-01 is active. Complete each sprint with scoped QA and guarded DEV readback before the next. S8–S12 and CF2–CF5 are deferred until after UX-07; their existing dependencies and approval gates remain intact.

Baseline at live `af0b35a`: A8 read-only preflight PASS, 179 TS/TSX/CSS files, three CSS files, four literal `!important` declarations, 17 inline style occurrences. Node Projects 1117 lines, Runit actions 961, Static sites 397. Mac read-only Test Lab captured 26 screenshots across six routes; desktop 1440×900: zero horizontal overflow, JS errors or failed requests, 7 small controls on Sites, 5 on Deployments, 3 on Logs; Sites document height 1471 px. Geometry is diagnostic, not full functional acceptance. Use desktop 1440×900 for the visual before/after comparison; expand coverage only where needed. Preserve the exact live public session and protected services. Source QA/build/deploy on A8 only; Mac Test Lab only for authorized read-only browser captures.

### UX-01 — Static Hosting workspaces (ACTIVE)

UX-01A extracted the detail panel (catalog page 397 to 62 lines). Exact-source `8e43290a574ccb945e1258539ca668c71466fa8c`: `pockethost-a8-ux01a-qa-8e43290-20261125-v1` gate 6/6 and budgets PASS, npm build wrapper failed on PATH; separate `pockethost-a8-ux01a-build-8e43290-20261125-v1` direct Vite PASS. `pockethost-a8-ux01a-hmr-8e43290-20261125-v2` terminal PASS, panel and protected services unchanged, publication unchanged, source readback PASS, no restart. UX-01B route separation deployed at `9b57e8a0d5b8e7590e72ed64c1568f6f94edb7cf`. QA `pockethost-a8-ux01b-qa-9b57e8a-20261125-v1` retained 27 unchanged passed files and completed 8/8 remaining files; all 35 mapped files, checks and build PASS. `pockethost-a8-ux01b-hmr-9b57e8a-20261125-v1` terminal PASS, 3 route HTTP checks, publication and protected services unchanged, no restart. UX-01C tabs candidate remains unqualified.

- [x] Separate list `/sites`, creation `/sites/new` (dedicated sidebar item and list CTA), and single-site workspace `/sites/:id`; keep old deep links functional, route selection validated against owned inventory, correct back/refresh/not-found behavior.
- [x] Keep list concise: name, observed status, address and useful summary; no embedded create form or mutation-heavy detail panels. On verified creation navigate to the new stopped site; after verified deletion return to list. Prevent duplicate writes, stale results and unknown-outcome retries.
- [ ] Organize detail by Overview, Files, Versions, Traffic, Public access, Logs and Settings; reuse existing hooks/components, preserve readback, lifecycle, release protections, public access and all existing features. No real-site mutation during QA.
- [ ] Migrate all route consumers and existing tests; add route isolation, deep link, invalid ID, success/failure and navigation regression tests. Exact-SHA A8 gate/build, separate guarded DEV deploy/readback, desktop visual comparison.

### UX-02 — Node.js Hosting workspaces (QUEUED)

- [ ] Separate application list, creation/import and selected application workspace; group runtime, source/dependencies/build, releases, logs, traffic, data/SQLite and backup into coherent views.
- [ ] Extract oversized controller/presentation responsibilities; preserve owner session, stale-response fencing, review/approval, staging, runtime and backup semantics. Test routes and cross-project isolation; QA/deploy/readback.

### UX-03 — Shared UI foundations (QUEUED)

- [ ] Inventory and consolidate existing shadcn primitives/compositions: page header and breadcrumbs, tables, action hierarchy, fields, status, empty/loading/error states, confirmations and accessible controls. Use Tailwind utilities and Lucide, not bespoke widgets.
- [ ] Unify control sizes, labels, icons, spacing and feedback; address measured small targets; preserve keyboard/focus behavior. QA/deploy/readback.

### UX-04 — Information architecture and noise reduction (QUEUED)

- [ ] Review every reachable screen at desktop 1440×900, including selected Node project and advanced sections; identify duplicate labels, descriptions, cards, inventory and navigation across Hosting, Services, Dashboard and Monitoring.
- [ ] Keep each screen focused on one task, one main action where meaningful; move technical IDs/PID/ticks into diagnostics. Consolidate duplicated presentation without removing distinct independent routes or essential warnings. QA/deploy/readback.

### UX-05 — CSS and template cleanup (QUEUED)

- [ ] Inventory CSS imports, selectors, Tailwind important modifiers, inline styles, arbitrary values and template leftovers. Remove unused App.css and unnecessary decorative transitions only after reference checks; preserve essential theme tokens, focus and reduced-motion behavior.
- [ ] Target zero custom presentation CSS and zero important overrides in application-owned code; document any indispensable vendor/behavioral exception. Keep genuinely dynamic styles where necessary, avoid moving CSS debt into arbitrary utilities. QA/deploy/readback.

### UX-06 — Module boundaries and enforceable quality (QUEUED)

- [ ] Split Projects, Runit actions/health, dashboard and other oversized view modules by ownership; separate data/actions/presentation, remove dead code after caller checks, avoid speculative wrappers.
- [ ] Extend current size/structure/boundary gates with view budgets (target 300 lines, cap 500 for new/changed views with explicit shrinking exceptions), CSS/important/inline-style checks and duplication measurement (target below 3% after defining scope/baseline). Do not count generated/vendor/theme data as view modules. Use existing tooling first. Preserve TypeScript, lint, Vitest and build gates. QA/deploy/readback.

### UX-07 — Visual and regression closeout (QUEUED)

- [ ] Repeat desktop screenshots of all reachable routes and relevant read-only detail states; compare before/after, inspect visual hierarchy, empty/error/loading states, keyboard/focus, control geometry and overflow. Zero unexpected console errors and failed requests; do not infer interaction PASS from screenshots.
- [ ] Exact-SHA affected and aggregate regression gates, final guarded DEV deployment/readback, updated handoff/quality evidence and owner visual acceptance. No unrelated host changes. Record remaining exceptions and defer further feature work until closure.
