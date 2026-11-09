---
status: source-implemented-hardware-validation-open
owner: core
last_reviewed: 2026-11-09
purpose: Record the M0 UI and service-boundary source sprint, immutable GitHub changes, queued native tests, and remaining legacy decoupling
---

# PocketHost M0 — Hosting/System separation source sprint

## Authority and scope

The owner on 2026-11-09 **explicitly authorized** beginning code
implementation from fresh `main`; this supersedes the earlier
`NO-CODE HOLD` in the [pre-implementation checkpoint](
2026-11-09-m0-preimplementation-readiness.md).
The second chat's already completed M0 navigation work and M1/M2
pure contract drafts were preserved, not reimplemented.

**Initial inspected source:** `PocketHost/main@b47359afc34f4a68ec0b38365504652e3538b313`.
**Last application-code commit in this sprint:**
`a410c66baf49d6fcc91b33de060cbaa9be289403`.
Always re-read current `main`; concurrent sessions may advance it.
All source edits were committed through the GitHub Connector to
`main` with expected file SHAs and no force-push. This sprint
issued **no running-device or package mutation**, no live update,
no DNS/tunnel changes and no protected-service lifecycle actions.

## What was actually implemented

- **System services vs Hosting:** `apps/admin/src/app/termux/page.tsx`
  no longer fetches `/api/v1/sites` in the Services screen.
  It exposes only observed external runit statuses and generic
  `RunitServiceActions`, and links to Hosting for website
  lifecycle. The unneeded H2 `SiteServiceActions` component was
  removed from `termux/admin-actions.tsx`; H2 APIs remain untouched.
- **System backups vs Hosting releases:** Backups & Recovery no
  longer fetches or renders H2 immutable website versions.
  Restic/H3/system backup controls remain in place. A link directs
  to the existing Hosting release manager; releases are not
  independent mutable-data backups.
- **File Manager vs project assets:** the Termux File Manager
  remains for system paths and does not fetch or list owned
  H2 sites. The existing `/api/v1/sites/:id/files` endpoint
  and strict `parseH3Files` decoder are reused by the
  `SiteCard` in `apps/admin/src/app/sites/page.tsx`.
  **Inspect assets** shows the active revision's bounded
  read-only file list, and can hide it. Publishing or changing
  a release clears the displayed list. No new backend or
  write route was added.
- **Navigation:** historical P3 Demo and managed PhotoMap
  TEST routes are no longer prominent Hosting menu items.
  Their direct URLs and read-only/admitted APIs are intentionally
  retained for compatibility. `/settings/network` moved
  into the Platform menu; Hosting still exposes Websites
  and Deployments. Old upstream template routes remain.
- **Small M1 source repair:** removed an unused
  `HostingDeclarations` type import from the already
  implemented M1 registry candidate after an actual
  S22 ESLint failure. No ownership semantics changed.

## Exact source commits (ordered)

1. `9ab936ef6e61ec8dae445ed6d613e04cd4a7ce56` — remove H2 start/stop from System service UI.
2. `5206912d4857af0f81d81053c34a9161efd2f5a4` — services test.
3. `f7f7015c5dec289999b50f8657f50697ba16e9ae` — remove H2 release cards from system backups.
4. `b29aa8cadf433bbee62b62c9eb768759ab2cb409` — backups test.
5. `c6c1f4b31d442804a6b60ca295519cb724b15a73` — unused M1 type import repair.
6. `bf0accaa34cc26251e515dc550c795c7a69fc641` — narrow Hosting navigation.
7. `d4b6e6dc89ef5a9a4e83f367a671657372662ebb` — retained-route navigation test.
8. `e12d720f26659dee0ecfc1ff619f13cc2d8703ad` — H2 assets read-only in Hosting.
9. `5c2a7fad7892297ac22191242444655d55deadf9` — Hosting assets interaction test.
10. `f0925926bc79ea9f13e4962339c5a9020637e5c4` — generic Termux File Manager.
11. `15eb7fa50b4bbb85387bb65f84b8462f38a1a8f5` — File Manager separation test.
12. `a410c66baf49d6fcc91b33de060cbaa9be289403` — remove obsolete duplicate H2 lifecycle controls.

## Tests and device evidence (strictly scoped)

Previous **S22 source receipt for the earlier `b47359a`**:
`pockethost-m0-m2-focused-s22-source-qa-b47359a-20261109-v1`
executed on the isolated Samsung QA checkout, with 11/11
targeted contracts and structures/docs/boundaries/TypeScript/
admin lint/build PASS. It reported an unused M1 import,
Prettier issues and one markdownlint issue; **not full PASS**,
and not evidence for the newer application tree.
The unused import was fixed above. Existing formatting
issues from that receipt must still be reconciled.

This sprint published three new exact-source native QA
tasks under the single `repository:pockethost` resource,
never to the production checkout:

| Target SHA | Task | Purpose |
| --- | --- | --- |
| `c6c1f4b31d442804a6b60ca295519cb724b15a73` | `pockethost-m0-ui-separation-native-s22-c6c1f4b3-20261109-v1` | System services/backups contracts, Node M0 negatives, lint/types/format |
| `d4b6e6dc89ef5a9a4e83f367a671657372662ebb` | `pockethost-m0-nav-followup-native-s22-d4b6e6dc-20261109-v1` | Navigation and retained-route contract |
| `15eb7fa50b4bbb85387bb65f84b8462f38a1a8f5` | `pockethost-m0-asset-relocation-native-s22-15eb7fa5-20261109-v1` | H2 asset inspector and Termux file separation UI, lint/types/format |

**At publication their terminal results were not yet
available; all three are QUEUED/UNKNOWN rather than PASS.**
Never replay the same task ID. Read the actual `task-results`
from Local Agent `agent-control` before recording a result.
The final obsolete-component removal commit
`a410c66b` has **not** been covered by one of these
exact-source QA tasks. Do not claim final M0 G2/physical
acceptance from partial QA. Future full closeout on
the latest source must use the normal Samsung Termux
agent restrictions in [quality gates](../QUALITY_GATES.md).

The older actual live phone panel/H2/protected-service
evidence in the [canonical handoff](
2026-11-09-code-quality-structure-handoff.md)
is historical and cannot be promoted to a current
device status. No latest live sample was taken here.

## Remaining M0 work and concrete next safe steps

1. **Consume native receipts first:** all three queued
   tasks can be inspected, never reissued. Fix source
   regressions/style only when grounded in their output,
   then run a focused exact-final-SHA source gate if needed.
   Refrain from starting a competing QA checkout.
2. **API legacy isolation:** `apps/admin/vite.config.ts`
   still defines fixed P3 and PhotoMap route plugins, and
   `observabilityApi` includes PhotoMap TEST log events.
   Keep old endpoints accessible until no active caller
   requires them. Extract behind compatibility adapters
   in narrowly scoped changes and replace brittle
   direct-source-name tests deliberately, not by deleting
   accepted negative guards.
3. **Generic host inventory:** `host-snapshot.ts`
   still has `SERVICE_CATALOG` labels for IleStoi and
   Local Agent; preserve read-only external observation
   and special private runit scope during any generic
   presentation rewrite. No new authority from discovery.
4. **H2 preservation:** after final source tests pass,
   an owner-approved native H2 disposable deployment,
   rollback, named protected-service comparison,
   private LAN behavior and actual device checkout SHA
   remain acceptance gates. Do not reset or restart
   the live application merely to validate a UI commit.
5. **M1/M2/M3 after M0:** persist planned project/module/
   service IDs only after confirmed positive ownership,
   one reusable `runit` adapter with policy-specific
   recovery, then early **disposable Node.js Hosting MVP**.
   No blanket autostart, global package updates or
   Cloudflare takeover.

**Current verdict: SOURCE M0 UI separation implemented;
named legacy API/source decoupling and native/live
acceptance OPEN.** Tests in source are not equivalent to
executed tests. The existing IleStoi, Cloudflare, SSH and
Local Agent services were not changed by this sprint.
