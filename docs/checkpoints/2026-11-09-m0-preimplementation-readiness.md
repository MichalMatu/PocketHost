---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Execution-ready M0 source decoupling plan without edits, tests or conflict with concurrent implementation
---

# M0 — pre-implementation readiness, no code execution

## Authority, snapshot and stop line

**Decision: PREPARATION COMPLETE / CODE M0 OPEN / NO-CODE HOLD.**
The owner requested preparation up to—but **not including**—any
source changes because another chat is editing PocketHost.
This document is a read-only analysis of GitHub source plus a
future implementation/test plan. The present chat must not edit
`src/`, `apps/`, `native/`, `ops/`, `tests/`, package locks,
host state, running services, site data, permissions, tunnel
configuration or the Local Agent task queue. Publishing these
notes is **not** authorization for the separate implementation
chat to deploy, stop services or migrate workloads.

Inspected `MichalMatu/PocketHost/main@2861c43f6d184830d6b39231f3f44b166989514d`.
It followed earlier M0 source-review snapshot
`4a52abef3d33bd1c9664fe2a0484ea18de738109` and
the latest source/format documentation updates. Another
chat may advance `main`; verify **fresh HEAD** and diff
the named files before any implementation. The observed
GitHub source is **not proof of the current Samsung running SHA**.

Read together with:

- [M0 source/upstream audit](2026-11-09-m0-source-and-upstream-audit-readonly.md)
- [Canonical roadmap](../ROADMAP.md)
- [Target architecture](../TARGET_INFORMATION_ARCHITECTURE.md)
- [Upstream reuse strategy](../UPSTREAM_REUSE_STRATEGY.md)
- [Previous code/quality/host handoff](2026-11-09-code-quality-structure-handoff.md)
- [Quality and real-device gates](../QUALITY_GATES.md)
- [Termux execution restrictions](../LOCAL_AGENT_TERMUX.md)

## Product decisions that must not drift

- **PocketHost = modular platform; Hosting = orchestrator.**
  **M0 is decoupling of old integration and display**, not the
  `ModuleRegistry`/`ServiceRegistry`/`ProjectRegistry`
  implementation (M1), universal health-recovery engine (M2)
  or Node Hosting (M3).
- Hosting lists only **explicitly user-created PocketHost
  projects**. Observed foreign runit services remain available
  for generic Termux system inspection, not automatic adoption.
  This does not remove the existing explicit generic
  Termux admin registration for eligible nonprotected units.
- Preserve H2 ZIP/folder, own loopback processes, release
  history, selected version restore, one-step rollback,
  logging, read-only LAN previews and exact owner verification.
- Preserve protected runit services and data. The six
  historically monitored services are `sshd`, `cloudflared`,
  `wreckscanner`, `mosquitto`, `ilestoi-healthwatch`
  and `termux-agent`; **`wreckscanner-backup` is a seventh
  separately protected runit name in the administration code**.
  Compare all applicable units, not just the six UI cards.
- Existing PocketHost panel recovery uses standard Termux runit;
  H2 currently starts exact-owned Node child processes itself;
  Local Agent has a **distinct pre-existing private runsvdir**.
  `One owner / one supervisor per managed service` does
  **not** mean collapsing these already-separated working
  supervisors during M0. The target is no *competing*
  supervisor for the same service after authorized migration.
- Do not expose the unauthenticated LAN administration UI,
  Shizuku Advanced Shell, runit service admin or future SSH
  controls through Cloudflare.

## Exact current dependency graph — source, not live evidence

| User-facing entry | Current request and controller | Actual implementation | Preservation/decoupling concern |
| --- | --- | --- | --- |
| `/sites` | `apps/admin/src/app/sites/page.tsx` -> `/api/v1/sites` | `ownedSiteFleetApi()` in `apps/admin/vite.config.ts` -> `SiteFleetHost`; ZIP/folder validators and exact H2 owner markers | **Primary H2 product; keep all routes, flags, ports and release semantics in M0** |
| `/services` | `termux/services-page.tsx` -> `termux/page.tsx` | Reads `/api/v1/observability` **and `/api/v1/sites`**; includes `SiteServiceActions` + `RunitServiceActions` | Remove *Hosting site controls from System UX* only after `/sites` remains capable; keep OS/runservice inventory |
| `/files` | `termux/page.tsx` files section | `TermuxFileExplorer` and duplicated site asset inventory from `/api/v1/sites/:id/files` | Keep single generic File Manager; move project file inventory/deep link to Hosting |
| `/backups` | `termux/page.tsx` backups section | System Restic + H3 workspace snapshots **and H2 release cards** | Keep system backups; show project release history separately. Release selection is **not** database/data backup |
| `/deployments` | `apps/admin/src/app/deployments/page.tsx` | Fetches **`/api/v1/owned-site/project`** (P3 demo only) | Name is misleading; do not pretend this is a multi-site deployment catalog. Preserve old route while linking to actual H2 releases |
| `/managed-projects` | `apps/admin/src/app/managed-projects/page.tsx` | Reads `/api/v1/managed-photomap` and `/api/v1/owned-site/project` | Legacy PhotoMap TEST import view. Remove from everyday navigation first; keep read-only route until compatibility/test migration |
| `/host` and `/observability` | Host and observability screens | `readHostSnapshot()` contains `SERVICE_CATALOG` with literal IleStoi/Local Agent service labels | Migrate named product cards to **generic OS service observations**, while retaining external/no-control semantics |
| `/owned-site` | P3 single demo route | `ownedDemoApi()`, `OwnedDemoHost` and `createOwnedSiteRuntime` | Historical demo can remain as compatibility fixture while H2 is canonical; never delete disk state or hijack its port |
| `/api/v1/managed-photomap` | `managedPhotoMapApi()` | `ManagedPhotoMapHost.inspect()`, GET-only disabled import catalog | Retire only when legacy client/tests deliberately move to compatibility or a closed fixture |
| `/api/v1/observability` | `observabilityApi()` | Host snapshot + `ManagedPhotoMapRuntimeHost().readLogs()` adds fixed PhotoMap-related runtime events | **Hidden secondary PhotoMap dependency**: isolating the visible route alone does not fully decouple |
| `/api/v1/termux-admin` | `termuxAdminApi()` | `TermuxServiceAdmin` protected registry + fixed package/file/Restic/terminal operations | Generic OS admin; KEEP in place and preserve explicit runit registration contract |
| `/h2/<site-id>/` | LAN gateway `18879` | `site-fleet-proxy.mjs` checks verified owned running H2 listener | Exact GET/HEAD-only preview path is a compatibility invariant |

The Vite composition is **one ~1,226-line file** at the
inspected source revision. It registers independent
`termuxReadOnlyApi`, `ownedDemoApi`, `ownedSiteFleetApi`,
`managedPhotoMapApi`, `observabilityApi`,
Shizuku/status/actions, network-access, Termux tools/admin
and route proxies. Split this composition *only* in
small compatibility-preserving follow-up edits, never a
single massive rewrite during M0.

### Explicit flags, identities and defaults

- H2 `ownedSiteFleetApi` currently requires both
  `POCKETHOST_ENABLE_OWNED_SITE_DEV=1` and
  `POCKETHOST_ENABLE_USER_SITES_DEV=1`.
- P3 `ownedDemoApi` requires the former flag separately.
- H2 `SiteFleetHost` has a bounded site pool, exact
  owner identity and immutable release directories.
  Preserve `/api/v1/sites` ID validation, upload budgets,
  write-intent/origin checks and dedicated loopback ports.
- LAN upstream is `127.0.0.1:8787`, with authorized
  private-address admin `18878` and GET-only H2 preview
  `18879`; no default public listener.
- `TermuxServiceAdmin` currently checks a protected
  name set *before mutation*, canonical target roots,
  explicit registry and bound command arguments.
- Generic runtime `createManagedRuntime` currently
  requires `autostart === false`; do not weaken it in
  M0 to make future service management superficially easier.

## Coupling-to-test matrix (edit these tests only with the intended feature)

| Legacy coupling | Tests with direct assumptions | Required migration discipline |
| --- | --- | --- |
| `SERVICE_CATALOG` literals IleStoi/Local Agent | `tests/quality/host-snapshot.test.mjs`; `apps/admin/tests/host-snapshot.interaction.test.tsx`; `apps/admin/tests/termux-center.interaction.test.tsx` | Retain valid generic external/unavailable status semantics; replace named-product assertions with generic OS capability assertions in same source change, not a blind deletion |
| `managedPhotoMapApi()` and named read-only page | `tests/quality/managed-photomap.test.mjs` **explicitly matches Vite source strings**, plus `apps/admin/src/app/managed-projects/page.tsx` | A naive removal breaks assertions. Keep the endpoint in a clearly legacy compatibility boundary or deliberately replace test contracts only once no active caller requires it |
| P3 demo plugin and its route | `tests/quality/owned-site-api-contract.test.mjs`, P3 runtime tests, `apps/admin/tests/owned-site-a11y.interaction.test.tsx` if present | Preserve current approved P3 behavior/flags, even if its menu card is hidden; do not remove old `/api/v1/owned-site` before a validated replacement |
| H2 site lifecycle/ZIP parsing/revisions | `tests/quality/site-fleet-host.test.mjs`, `site-fleet-releases.test.mjs`, `site-bundle.test.mjs`; `apps/admin/tests/site-fleet.interaction.test.tsx` | No M0 change is allowed to weaken PID/start-ticks, port conflicts, upload confinement, release history, archive restore or rollback |
| Runit registration and aliases | `tests/quality/h3-runit-service.test.mjs` | Keep foreign/unknown service refusal, symlink alias prevention, `down` marker semantics, exact target registry |
| LAN proxy and route permissions | `tests/quality/lan-gateway.test.mjs` | Preserve exact private bind/Origin rules, GET-only site proxy, fixed upstream timeout behavior |
| General menu and route preservation | `apps/admin/tests/termux-center.interaction.test.tsx`; `tests/quality/admin-preservation.test.mjs` | Maintain old direct URLs and imported upstream template routes, while reducing everyday menu clutter |

**Test names describe source contracts that exist. None of
these tests was executed in this chat.** The source file
actually present is `apps/admin/tests/owned-site-a11y.interaction.test.tsx`
only if verified again on fresh tree; the earlier tree
lists `owned-site-a11y.interaction.test.tsx`, and this
should be checked before targeting the specific test.

## Future M0 implementation slices — no edits authorized here

**A. Confirm ownership and baseline (read-only, on phone).**
The implementation chat obtains fresh `main`, existing H2
site list/IDs/releases and exact owned-process identity, panel
state, `down` markers, all applicable foreign service statuses,
current private LAN status and prior rollback SHA. Avoid
replaying already completed QA just for a new menu edit.
The old checkout/data must remain recoverable.

**B. Menu cleanup (small UI patch).**
In `apps/admin/src/config/navigation.ts` and
`routes.tsx`, make H2 Websites the primary Hosting path,
hide P3 Demo and imported PhotoMap catalog from primary
navigation, and keep their direct routes temporarily.
Do not add fake Node/SSH/Cloudflare module pages before
real adapters exist; module menu becomes concrete in M1–M4.
Confirm no upstream template route has been removed.

**C. Separate System and Hosting displays (small UI patch).**
In `termux/page.tsx`, retain generic File Manager,
Termux packages, real OS service inventory/controls and
system/Restic backups; remove embedded *owned-site
lifecycle controls* and duplicated project-release panels.
`/sites` remains the canonical H2 project manager.
If the dedicated system views rely on `SiteServiceActions`
from `termux/admin-actions.tsx`, remove only its
unused UI wiring after focused test updates; do not
delete the underlying H2 endpoints.

**D. Generic host observations (bounded contract patch).**
Analyze `host-snapshot.ts`, consumers and schema/tests.
Replace named product-specific cards with generic Termux
runit status where appropriate, but preserve absence,
unknown, local/private-agent scope and external ownership.
Do **not** reclassify `wreckscanner` or `termux-agent`
as PocketHost-managed services. The separate
`TermuxServiceAdmin` list is OS observation only.

**E. Extract compatibility-specific handlers (bounded API patch).**
Preserve the P3 and PhotoMap GET-only endpoints as
*legacy compatibility* initially; decouple their use
from new Hosting and from generic Observability.
Prefer thin, independently testable route adapters over
rewriting `vite.config.ts` en masse. Retire old route
implementation only after no consumer or test requires
it and a data/rollback plan exists.

**F. M0 closeout (new exact-source acceptance).**
After the owning implementation chat has completed
source edits, compare before/after H2 release inventory,
static HTTP readiness, H2 create/publish/release
restore/rollback, service owner markers, generic
Termux lists and six-plus-backup protected service
state. Record accepted vs open checks and rollback
SHA in a new checkpoint. Only then consider M0
code decoupling complete.

The bounded M0 code outcome is **cleaner navigation and
generic observation without altering operational
ownership**. No first Node backend, new service
autostart, SSH key rewrite, Cloudflare route edit,
Python/PRoot execution or actual IleStoi/Agent
migration belongs in M0.

## Test commands for the *implementation chat* (not executed here)

Run exclusively on the verified Samsung Termux Local
Agent and the exact source revision, never Mac,
ChatGPT Linux sandbox, GitHub Actions, Codex or Work.

| Purpose | Scoped command or check |
| --- | --- |
| Quick top-level route preservation | `npm run dev:quick` |
| System/Hosting UI interactions | `npm run dev:ui -- tests/termux-center.interaction.test.tsx` |
| H2 browser component UI contracts | `npm run dev:ui -- tests/site-fleet.interaction.test.tsx` |
| Host named-to-generic contract | `node --test tests/quality/host-snapshot.test.mjs` |
| P4 legacy compatibility | `node --test tests/quality/managed-photomap.test.mjs` |
| Exact H2 release and rollback | `node --test tests/quality/site-fleet-host.test.mjs tests/quality/site-fleet-releases.test.mjs` |
| Runit protected service scope | `node --test tests/quality/h3-runit-service.test.mjs` |
| LAN/proxy route behavior | `node --test tests/quality/lan-gateway.test.mjs` |
| Critical core/API milestone closeout | `npm run dev:full` (= `npm run check:all`) on exact source SHA; reuse completed QA receipts for unchanged source rather than replay |
| Real device acceptance | Owner-chosen H2 disposable site, loopback/LAN HTTP, rollback and read-only foreign-service comparison; **never real PhotoMap Start** |

Before running, check which tests have **already passed
for the same exact SHA**, so no completed work is repeated.
For one small UI-only patch use the proportional quick
test and live DEV/HMR review; for contract/host changes
use targeted negative tests then full milestone QA.
Preflight and native checks are not authorized by
this *documentation-only* sprint.

### Failure/rollback and stop conditions

Stop and do not deploy if any of the following occurs:

- `main` changed in the same target files while
  preparing a patch or the other code chat is still
  editing them; rebase mentally against fresh tree
  and coordinate ownership rather than force-push.
- Existing H2 site list or active releases change
  unexpectedly; H2 owned PID/start-ticks is unclear;
  test uses production site data rather than a
  disposable fixture.
- A protected Termux service changes state,
  `cloudflared` gains an additional competing
  supervisor/tunnel, Local Agent has a duplicate
  consumer, or a new API exposes arbitrary external
  process control.
- The private admin/proxy ports or Origin/Host/intent
  checks are weakened; any admin LAN endpoint becomes
  reachable from untrusted/public networks.
- A legacy endpoint is removed while a UI route,
  source test or deployed browser still requires
  it; current exact-source native tests fail and
  the previous known-good deployment cannot be
  restored.
- Any install/backup/restore operation alters
  Home, app worktrees, DB/uploads or global Termux
  packages as an accidental side effect of M0.

Rollback should restore only the verified
PocketHost-owned source/panel, retaining the
previous known-good SHA and running-site data.
Never use force-push, broad `pkill` or PID-only
kill. Do not automatically `git reset` a live
checkout during someone else's work.

## Reuse decisions ready for M1–M3

- **Reuse unchanged:** H2 static parser/server/fleet,
  releases and rollback; `TermuxServiceAdmin`
  exact-target guard; current package inventory,
  Restic CLI adapter and independent panel runit.
- **Extract only narrow contracts:** process
  identity/readiness, runit observation and
  controlled service ownership. Avoid a giant
  `BaseService` abstraction with unfinished
  Node/Python/Cloudflare implementations.
- **Node first:** `package.json` + lockfile,
  native `npm ci`, one disposable app/port,
  H2-derived staging/rollback. No Docker or PM2.
- **Cloudflare later:** one shared module, reuse
  the installed binary/config and validated
  ingress, no second tunnel or inherited control
  over externally owned `cloudflared`.
- **Local Agent last:** preserve existing private
  runsvdir, STOP, durable claim/result history
  and UNKNOWN/no-replay semantics; independent
  SSH/USB operator for actual cutover.
- **No third-party wholesale copies:** inspect
  exact upstream revision, license/NOTICE,
  Termux ABI compatibility and tests first.
  References: [reuse matrix](../UPSTREAM_REUSE_STRATEGY.md).

## Final readiness verdict and handoff

| Dimension | Verdict |
| --- | --- |
| Source graph and high-risk integrations | **PREPARED** (frozen SHA and path mapping) |
| Ordered, non-overlapping M0 code slice plan | **PREPARED — not executed** |
| Existing API/deep-link compatibility plan | **PREPARED — must be validated** |
| Targeted negative/positive test mapping | **PREPARED — no tests run here** |
| Upstream reuse and architecture fit | **PREPARED** |
| Phone/live state and current panel source | **NOT RECHECKED in this chat** |
| Actual M0 code decoupling and deployment | **OPEN — second chat owns source** |
| Final M0 PASS | **OPEN** |

**Next concrete operation is the first code patch from
slice B, but only in the already-active implementation
chat after it verifies current HEAD and owns that patch.**
This document deliberately stops immediately **before**
source modification.
