---
status: active
owner: product
last_reviewed: 2026-11-26
purpose: Detailed UX sprint acceptance checklist
---

# PocketHost UX execution plan

## Current priority

The owner approved the UX audit and reprioritized the development queue. Retain React, TypeScript, shadcn/ui, Tailwind and Lucide; no framework migration, new hosting features or security sprint. UX-03 and the scoped UX-04 Hosting/Deployments work are active; UX-01 and UX-02 workspace implementation and DEV deployment are verified, with detail-screen visual acceptance pending. Complete each sprint with scoped QA and guarded DEV readback before the next. S8–S12 and CF2–CF5 are deferred until after UX-07; their existing dependencies and approval gates remain intact.

Baseline at live `af0b35a`: A8 read-only preflight PASS, 179 TS/TSX/CSS files, three CSS files, four literal `!important` declarations, 17 inline style occurrences. Node Projects 1117 lines, Runit actions 961, Static sites 397. Mac read-only Test Lab captured 26 screenshots across six routes; desktop 1440×900: zero horizontal overflow, JS errors or failed requests, 7 small controls on Sites, 5 on Deployments, 3 on Logs; Sites document height 1471 px. Geometry is diagnostic, not full functional acceptance. Use desktop 1440×900 for the visual before/after comparison; expand coverage only where needed. Preserve the exact live public session and protected services. Source QA/build/deploy on A8 only; Mac Test Lab only for authorized read-only browser captures.

### UX-01 — Static Hosting workspaces (ACTIVE)

UX-01A extracted the detail panel (catalog page 397 to 62 lines). Exact-source `8e43290a574ccb945e1258539ca668c71466fa8c`: `pockethost-a8-ux01a-qa-8e43290-20261125-v1` gate 6/6 and budgets PASS, npm build wrapper failed on PATH; separate `pockethost-a8-ux01a-build-8e43290-20261125-v1` direct Vite PASS. `pockethost-a8-ux01a-hmr-8e43290-20261125-v2` terminal PASS, panel and protected services unchanged, publication unchanged, source readback PASS, no restart. UX-01B route separation deployed at `9b57e8a0d5b8e7590e72ed64c1568f6f94edb7cf`. QA `pockethost-a8-ux01b-qa-9b57e8a-20261125-v1` retained 27 unchanged passed files and completed 8/8 remaining files; all 35 mapped files, checks and build PASS. `pockethost-a8-ux01b-hmr-9b57e8a-20261125-v1` terminal PASS, 3 route HTTP checks, publication and protected services unchanged, no restart. UX-01C `916801b1b83b206ef5f774a4538ff23945e8ccf8`: `pockethost-a8-ux01c-qa-916801b-20261125-v1` 5/5 static gates, 82/82 tests in 11 mapped files, budgets and Vite build PASS; `pockethost-a8-ux01c-hmr-916801b-20261125-v1` terminal PASS, three routes HTTP reachable, tab source readback PASS, unchanged panel PID/start ticks, protected services and publication. No restart.

- [x] Separate list `/sites`, creation `/sites/new` (dedicated sidebar item and list CTA), and single-site workspace `/sites/:id`; keep old deep links functional, route selection validated against owned inventory, correct back/refresh/not-found behavior.
- [x] Keep list concise: name, observed status, address and useful summary; no embedded create form or mutation-heavy detail panels. On verified creation navigate to the new stopped site; after verified deletion return to list. Prevent duplicate writes, stale results and unknown-outcome retries.
- [x] Organize detail by Overview, Files, Versions, Traffic, Public access, Logs and Settings; reuse existing hooks/components, preserve readback, lifecycle, release protections, public access and all existing features. No real-site mutation during QA.
- [x] Migrate route consumers and existing tests; add route isolation, deep link, invalid ID, success/failure and navigation regression tests. Exact-SHA scoped A8 gate/build and separate guarded DEV deploy/readback PASS.
- [ ] Desktop visual comparison at 1440×900: catalog, create form and seven tabs of a verified owned site. Mac Lab uses standing read-only consent pinned to exact live SHA per [Test Lab](TEST_LAB.md); its current fixed route aliases do not cover the new create/detail screens. Keep capture read-only (same-origin GET/HEAD, no form submits or site mutations), images private, compact geometry report only. Owner reprioritized UX-02 after reviewing Node screenshots; retain this visual acceptance item.

### UX-02 — Node.js Hosting workspaces (IMPLEMENTED)

Owner requested modular folders, a compact Node workspace and enforceable quality gates. Split catalog, creation, diagnostics, backups and per-project tabs; keep legacy project links. Route entry is limited to 120 lines, new view/state/action modules to 350 lines and the existing 24 KiB source budget. No reverse view dependencies or direct browser transport in view modules. Affected checks include budget tests and shared test-helper consumers. Scoped QA/build and guarded DEV deployment PASS at `47f4f1186d92665b2e0df560567a2d3a90acfa01`. No new hosting ingress.

- [x] Separate application list, creation/import and selected application workspace; group runtime, source/dependencies/build, releases, logs, traffic, data/SQLite and backup into coherent views.
- [x] Extract oversized controller/presentation responsibilities; preserve owner session, stale-response fencing, review/approval, staging, runtime and backup semantics. Test routes and cross-project isolation; QA/deploy/readback.

- [ ] Complete visual inspection of create, detail and advanced workspace screens; the Node catalog rendered at all three viewports with no horizontal overflow or JavaScript errors.

### UX-03 — Shared UI foundations (ACTIVE)

Shared sidebar layout and global stylesheet cleanup deployed at `b8051992d4ea3640f06606d5bba01a11df965dd8`: 175/175 UI tests across 28 files, scoped Node, syntax, formatting, lint, types, budgets and build PASS. Removed four global `!important` rules. Read-only Mac geometry comparison: Dashboard, Projects and Network 9/9 rendered, no new overflow or JS/request failures. Network link target cleanup deployed at `cf29a0aa6ec94cba3858cb315beae49472d04eb5`; scoped QA/build PASS. Network 3/3 after-captures show zero small controls (previously two) and zero overflow. Existing projects, publication and protected services unchanged. Visual inspection, nondefault sidebar combinations and broader control inventory remain open; geometry does not substitute for visual or interaction acceptance.

- [ ] Inventory and consolidate existing shadcn primitives/compositions: page header and breadcrumbs, tables, action hierarchy, fields, status, empty/loading/error states, confirmations and accessible controls. Use Tailwind utilities and Lucide, not bespoke widgets.
- [ ] Unify control sizes, labels, icons, spacing and feedback; address measured small targets; preserve keyboard/focus behavior. QA/deploy/readback.

### UX-04 — Information architecture and noise reduction (ACTIVE)

Services/Workloads at `7730e62` and screenshot-driven heading/health refinements at `5fcabbe`: exact-source QA/build and guarded A8 deployments PASS. Offline A8 frontend-only bundles (empty env, no backend plugins) rendered five routes at 390/768/1440px on Mac with synthetic fixtures: 15/15 before and 15/15 after, zero horizontal overflow/JS exceptions. Desktop/mobile images inspected; visible page titles, stronger section hierarchy, concise guidance and rollback candidate ID inside disclosure verified. Services overview keeps same navigation. Baseline and after JPEGs in private Local Agent repo `.agent/artifacts/pockethost/visual-qa/{7730e62,5fcabbe}/` (commits `2f917ba` and `6a1f071`); do not copy real user data. Runit inventory intentionally unavailable in fixture; real health/interaction states and LAN visual acceptance remain open. A8 loopback/ownership/protected services/project/publication readback PASS; gateway bind absent. Next: Monitoring and Project Logs UX audit, then remaining routes. Do not re-run already qualified synthetic capture merely to advance the queue.

Hosting/Deployments layout at `1efa081` passed exact-source QA/build and guarded DEV deployment. Two synthetic desktop previews informed the refinement at `a38571c`: status adjacent to project name, action hierarchy, technical release IDs in disclosure, desired-state mismatch retained. Exact-source QA/build/deployment PASS at `a38571c`; 20 local after-captures, 12/12 rendered with no JS/request failures, overflow or small controls. Final image inspection is pending (synthetic preview timed out). A8 loopback remains reachable and exact source verified; LAN gateway bind absent and wlan0 IPv4 not reported by the read-only probe. Mac TCP probes failed. Do not treat geometry as aesthetic acceptance or repeat passed QA. Restore visual access only within the existing owner-approved network policy.

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
