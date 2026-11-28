---
status: draft-awaiting-owner-approval
owner: product
last_reviewed: 2026-11-28
purpose: Single ShadcnStore-derived visual composition contract
---

# PocketHost — visual composition standard

**DRAFT — not approved. No runtime migration before owner approval.**
This contract supplements [agent rules](../AGENTS.md), [Fast Flow](DEV_ITERATION.md),
[Test Lab](TEST_LAB.md) and [UX evidence](UX_EXECUTION_PLAN.md). Preserve business
logic, API, security, existing appearance configuration, hosted projects and
protected services. No parallel visual system, cosmetic wrappers or local
Tailwind replacements for CSS debt.

## Pinned reference and evidence

- Source: [d65a3e1](https://github.com/MichalMatu/PocketHost/tree/d65a3e118cbc8598234043593b41ad2ed41922fb).
  Last attested live runtime: 47fe02817e679472024b9ec59560b440e62512a7.
  The four following commits change only docs, quality scripts and their test.
  This is not a fresh live-device probe.
- Canonical reference: [ShadcnStore Dashboard Vite v2.0.0](https://github.com/shadcnstore/shadcn-dashboard-landing-template/tree/f12bbecb7e9f9df77c49e4d27b02433f110de0e8/vite-version),
  SHA f12bbecb7e9f9df77c49e4d27b02433f110de0e8. PocketHost import
  1f00063efb9922e6251727fcd053c38f6bf06d90, matching package identity and
  dependencies and matching Button/Card implementations corroborate this
  reference. Exact original upstream import metadata was not independently
  located. Preserve the MIT notice; no upstream-main tracking, reinstall or
  import of demo features/dependencies.
- Reuse terminal A8 audit pockethost-a8-ux03-component-composition-inventory-47fe028-20261128-v1,
  private receipt commit 939eea7d9801ac7899d45c6103a7121ebca4e4b2:
  read-only PASS, exit 0, clean source. 109 TSX files, 22 BaseLayout,
  247 Button, 58 Card, 53 CardHeader, 53 CardTitle, 56 CardContent,
  27 CardDescription, 1 CardAction, 99 Badge, 25 Input occurrences.
  Static counts, not rendered controls or exhaustive semantic coverage.
- Five wrappers: 11 space-y-4, 5 flex gap-5, 4 space-y-5, 1 flex gap-4,
  1 no section gap. Button sizes: 203 default, 32 sm, 8 lg, 4 icon.
  Variants: 176 outline, 34 default, 27 dynamic, 6 ghost, 1 secondary,
  2 destructive, 1 link. Differences need semantic review, not blanket bans.
- Do not repeat unchanged source audit. Existing synthetic and LAN captures
  are bounded evidence, not complete cross-page visual acceptance.

## Root causes

| Consumer | Verified source divergence | Migration |
| --- | --- | --- |
| BaseLayout | Original visible title replaced with sr-only; vertical padding/gaps compacted | Restore one shared visible title and layout-owned gutters; remove local duplicates as consumers migrate. |
| /hosting | aria-hidden text-xl heading; space-y-5; outline/lg Refresh min-h-10 without icon; custom flex in CardHeader | Canonical page slots, shared Refresh, native CardAction/Title/Description and inventory rows. |
| /sites | Local h1, space-y-5, default outline Refresh with icon, custom bordered list | Same header and actions; shared catalog rows/status. |
| /projects/new | Back button precedes and displaces title; space-y-4; NodeRefresh separate; styled details/summary form | Stable title anchor, shared Refresh, native Card/Field composition; preserve guards and context-specific disclosure. |
| Other routes | Host metric padding overrides, multiple local heading patterns, Dashboard/detail/log overrides | Classify semantic roles; consolidate shared appearance centrally. Functional grid spans and text wrapping are not inherently defects. |

## Proposed canonical compositions

Upstream paths below are relative to the pinned Vite src directory.
Nominal pixels assume a 4px spacing unit and 16px root font. Measure actual
computed geometry in matching theme, sidebar and viewport. The upstream
itself has multiple heading styles (Account Settings uses 3xl); selecting
its BaseLayout 2xl as the single ordinary page heading is a proposed
PocketHost decision, not a claim that every upstream screen is identical.

| Role | Upstream reference and contract | Variants / migration / restrictions |
| --- | --- | --- |
| Shell | components/layouts/base-layout.tsx, components/site-header.tsx: SidebarProvider/Inset/SiteHeader, container/main; sidebar 16rem, collapsed 3rem, header spacing*14 | Retain existing sidebar modes and navigation. No marketing/footer additions or page-specific shell. |
| Body | BaseLayout gap-4 py-4, md:gap-6 md:py-6; px-4 lg:px-6; dashboard section gap-6 | One owner for gutters and spacing; full-bleed table only with equivalent inner gutters. No duplicate padding or competing page-level gap. |
| Heading/actions | BaseLayout visible h1 text-2xl font-bold tracking-tight; description muted, gap-2. Upstream toolbar composition for actions. | One visible h1, stable origin; optional description; proposed right action group gap-2, wrap below on narrow screens. Back/breadcrumb separate from title anchor. Use existing layout slots, not extra cosmetic wrappers. |
| Buttons | components/ui/button.tsx already matches upstream: default h-8 (32px), gap-1.5, px-2.5, icon size-4; sm h-7, lg h-9, icon size-8. | Primary default; secondary operation outline; contextual ghost; destructive only for danger; links for navigation. Proposed Refresh outline/default with RefreshCw inline-start, visible label and same busy/disabled semantics, rightmost after primary when present. Existing touch targets must not regress: approve one shared responsive variant if required, never page min-height overrides. |
| Cards | components/ui/card.tsx matches upstream: rounded-xl bg-card ring-1 ring-foreground/10, card-spacing 4 (16px), sm 3 (12px); native Header, Title, Description, Action, Content, Footer. | Header actions via CardAction, text-base medium title, muted description, native footer when needed. Compact only named composition. No per-page backgrounds, border, radius, shadow or padding. |
| Metric cards | app/dashboard/components/section-cards.tsx: grid gap-4, sm two/xl four; numeric title 2xl/3xl, outline Badge in CardAction, footer | Metrics only; upstream group gradient/neutral dark treatment, not for ordinary cards. Functional grid spans allowed. |
| Forms | app/settings/account/page.tsx and components/ui/field.tsx: Card/Title/Description, form gap-6, Content gap-4, FieldGroup/Field/FieldLabel/Input/FieldError; input h-8 | Single column on narrow screens; paired fields gap-4 where space permits. Common final submit slot, not beside input. Preserve existing validation and unknown-state logic. Proposed width inherited from page/card; bounded form variant only after review. Restore original Field primitives if absent; no state-library migration. |
| Lists/tables/filter | app/users/components/data-table.tsx, app/tasks/components/data-table-toolbar.tsx, components/ui/table.tsx. Toolbar flex gap-4, filters gap-3, one column to md three. | Existing actions only, aligned headers/status/actions, native search/input/select. Simple inventory list proposed as shared CardContent divided-row adaptation; keep semantic list. No new table features or custom per-page density. |
| Tabs | components/ui/tabs.tsx: gap-2, native h-8, default muted or line variant | One shared multirow workspace variant for Static/Node because overlap previously proven at all widths. Preserve wrap repair, focus, state/deep links. Exact variant subject to geometry review. |
| Dialogs/sheets | components/ui/dialog.tsx, sheet.tsx, app/users/components/user-form-dialog.tsx. Dialog gap-4 p-4 rounded-xl, viewport minus 2rem, sm:max-w-sm; form example sm:max-w-2xl; sheet gap-4 header/footer p-4, side 3/4 and sm:max-w-sm | Native slots, form-size variant when justified; unchanged keyboard/focus, confirmations. No bespoke overlay, modal radius or arbitrary widths. |
| Status/feedback | components/ui/badge.tsx h-5 rounded-4xl text-xs; Alert rounded-lg px-2.5 py-2; Skeleton muted rounded-md | Proposed normal/running secondary, stopped outline, failure destructive; unknown distinct and textual. Alert for actionable errors, native status region for progress, skeleton only where semantics permit. Empty: shared muted text and existing relevant CTA; no dedicated Empty component verified upstream. Keep all warnings, pending and unknown outcomes. |
| Themes/responsive | Native tokens, BaseLayout and existing theme customizer | Preserve modes, presets, radius and sidebar configurations; semantic tokens only. Mobile 390x844, tablet 768x1024, desktop 1440x900. No page-specific hex, fixed radius, new CSS or one-off breakpoints. |

These product-specific composition choices (back/actions, Refresh, inventory
rows, form width, long tabs, status mapping and accessible touch variant)
require owner approval and baseline geometry review. No new feature or
framework. Shared changes must regress every affected consumer.

## Route/state inventory

Derived from current [routes](../apps/admin/src/config/routes.tsx) and
[navigation](../apps/admin/src/config/navigation.ts), supplementing the older
[screen map](NAVIGATION_MAP.md). This is a coverage register, not proof every
state has rendered. Enumerate conditional states from source and fixtures
before migrating each route. No real mutations for visual QA.

| Group | Routes and state families |
| --- | --- |
| Overview | /dashboard (basic/enhanced, telemetry/chart ranges); /observability (filters, sort, details); /host (inventory, unavailable). |
| First reference screens | /hosting (both inventories, readiness, loading/empty/disabled/unavailable); /sites (catalog, capacity, empty/error); /projects/new (authorization, validation, pending/confirmed/rejected/unknown). |
| Static | /sites/new (empty, ZIP/folder, starter); /sites/:id and legacy query (Overview, Files, Versions, Traffic, Public access, Logs, Settings; disclosures, lifecycle, not found and errors). |
| Node | /projects; /projects/:id and legacy query (all eight tabs, runtime/source/release/logs/traffic/data/SQLite/backup, review/staging states); /projects/backups; /projects/diagnostics. |
| Hosting operations | /deployments (both inventories and release histories); /runtime-logs (selection, search, empty/error/loading). |
| Services | /services; /services/runit (observed/desired, owned/protected, disclosures); /services/autostart; /services/hosting; /services/health; /services/cloudflare; /services/ssh; /services/mqtt; generic /services/:serviceId (known/unknown). |
| Agent | /local-agent (Overview, Tasks & activity, Live console, Control, Diagnostics). |
| Tools | /shizuku (apps/packages/permissions/processes/services/shell); /phone-settings; /packages (installed/available/filter/review); /files (browse/import/editor); /terminal (inactive/connected); /backups (archive/restore review). |
| Automation/settings | /agents; /settings/platform; /settings/network; /settings/appearance (modes, customizer, sidebar). |
| Additional | /owned-site DEV-only; catch-all 404; redirects /, /termux, /system; global search, mobile sidebar, navigation loading/error, focus and dialog/sheet states. |

Record route/state, reference, divergence, before/after capture IDs,
computed geometry/style vector, functional test evidence, exception or none,
owner review and status. Cover applicable viewport/theme combinations.
Reuse existing evidence only when runtime, state and scope match.

## Visual gates and enforcement

1. Before device work verify fresh main and actual live A8 SHA, ownership,
   clean checkout, PID/ticks, protected services, HTTP and rollback. Mac
   only read-only allowlisted Test Lab, exact verified source SHA. Private
   captures remain local. If current allowlist lacks necessary states,
   separately scope lab tooling; use synthetic fixtures for unsafe
   mutations and label evidence.
2. Capture a common style/geometry vector by semantic slots: title/body/back,
   page action group, Refresh, ordinary/metric card header/content, field,
   table/list row, tabs and panel. Measure bounding rect, font/weight/line
   height, margin/padding/gap, height/width, background/color/border/radius,
   alignment and icon dimensions. Return only bounded non-sensitive data.
3. Compare equivalent roles across routes at same viewport and appearance:
   title and body anchor relative to shell, action position where fitting,
   equal-role sizes and style, card internal spacing and form alignment,
   tab clearance. Compare deliberate responsive wrap rules, not content-
   dependent width/height. Proposed tolerance 1 CSS px for invariant
   geometry; normalized token/color equality. Exceptions must identify
   role, functional reason, source reference and scope.
4. Extend existing presentation gate with narrow AST checks for duplicated
   page headers, handmade page card surfaces, same-role Button overrides,
   and unauthorized style changes. Test positive/negative detector fixtures.
   Enforce migrated consumers first, expand each iteration, track remaining
   legacy findings. No broad regex bans on functional wrap/grid classes.
5. After approval: one screen at a time: Hosting overview, Static websites,
   Add Node.js application, then remaining routes. Inspect dependencies,
   implement common composition, separate A8 exact-SHA QA/build and affected
   regressions, guarded Fast Flow once, live readback, matching read-only
   Mac captures and cross-page comparison. Stop for owner evaluation before
   next screen. Unknown/guard failure HOLD, no replay. No panel-terminal
   restart. Fix shared defects centrally and regress migrated consumers.
6. Close only after all applicable states accounted for, exceptions justified,
   no parallel system, aggregate regression and live readback, and actual
   owner visual acceptance. Functional PASS, zero JS errors or zero overflow
   is not visual acceptance.

## Approval status

Source audit reused and initial upstream/source comparison complete for
three reference screens. Full cross-route actual visual comparison, exact
original import provenance metadata and final geometry calibration remain
open. Finish targeted read-only baseline and update this draft before final
approval of unresolved choices. No migration authorized by this document.
