---
status: proposed
owner: core
last_reviewed: 2026-11-07
purpose: Define canonical PocketHost milestones including Observability O1
---

# PocketHost Roadmap

## Accepted baseline

Application source `bc5e5539ca4656e59077335b71c0875f967ea859`
passed 101/101 Node and 16/16 UI tests on Samsung;
a separate owned P3 HTTP Publish/Rollback/Stop/Start
cycle passed. This is not production acceptance.

## O1 — Observability: Samsung source and LAN HTTP accepted, Mac browser pending

**Observe and diagnose first; automate only after
separate safety and release gates.**

1. **O1.0 Preflight:** fresh main, Samsung Local Agent,
   prior pending QA receipts, six foreign-service
   invariants and PhotoMap port 8010.
2. **O1.1 Host Monitor:** real CPU delta, RAM, storage,
   battery and network where accessible; service health
   with stale and missing states.
3. **O1.2 Process Inspector:** bounded process trees,
   PID/start-tick evidence, safe resource observations
   and explicit external/unknown/owned classification.
   Never signal discovered processes.
4. **O1.3 Runtime Diagnostics:** sanitized starts,
   crashes, timeouts, orphan suspects, retained
   unknown claims and recovery dry-run decisions.
5. **O1.4 Package Inventory:** read-only Termux,
   Node/npm and Python installed versions and
   available-update metadata where safe.
6. **O1.5 Dashboard:** real metrics, small history
   charts, process status and understandable alerts.
7. **O1.6 Acceptance:** targeted negative tests,
   native Samsung results, exact-SHA `check:all`,
   browser/device evidence and a single checkpoint.

Samsung source `315e063` passed full native QA and 19/19 UI tests.
A guarded deployment verified O1 routes, real GET API and safe
manual LAN management on the phone, preserving six external services.
Later `f0dd506` repaired intermittent LAN O1 502 responses:
Samsung check:all PASS, 3/3 LAN HTTP 200 and preserved services.
See the [502 recovery](checkpoints/2026-11-07-o1-502-live-recovery.md).
Real new-version Mac visual and interactive acceptance remains open.
CPU/battery/network may be inaccessible under Android permissions.
See [live O1/LAN checkpoint](checkpoints/2026-11-07-o1-lan-live-acceptance.md).

Deliver useful vertical slices rather than mock screens.
Use the existing module owners plus the new pure
`observability` aggregation contract.

## Parallel release holds

- P3 real browser Publish/Rollback click, keyboard
  and ARIA acceptance remains unverified after a
  Chromium read-only timeout.
- PRoot detached descendants, uncertain startup,
  orphan recovery and full restore remain unproven.
- PhotoMap live Start/health/Stop is not approved;
  any test on disposable copied data requires
  separate explicit authorization.

## Later product milestones

- **Package & Software CMS:** reviewed update plans,
  dependencies, explicit approvals and safe execution.
  Treat Termux rolling-release upgrades differently
  from app-local dependency updates.
- **Publish MVP:** create, deploy and update a new
  generated site with health, rollback, HTTPS/domain
  workflow and an explicit security model.
- **AI and API:** scoped authenticated capabilities
  integrated with existing Local Agent execution,
  not a public arbitrary shell. Local models and
  AI Calls integration remain optional.

Each milestone requires exact-SHA source and
physical acceptance. See [development plan](DEVELOPMENT_PLAN.md)
and [ADR-0010](adr/0010-read-only-observability.md).

## H1 — Hosting MVP: one owned application, accepted

The current large functional sprint is scoped to the **explicitly registered**
`pockethost-demo` static application only. It adds a browser-driven
Create → Start → HTTP Health → Publish v1/v2 → one-step Rollback →
Restart → Stop flow, a real project inventory entry, process-verified
details, a bounded persistent deployment history and owned runtime logs.

The existing P3 backend, ownership marker, loopback listener and trusted-LAN
gateway are reused. The PhotoMap TEST catalog remains read-only and the six
external services are excluded from every mutation. Imported admin template
routes are retained and labeled as examples.

**Status: accepted.** Samsung G2 passed 115/115 Node and 23/23 UI,
then the guarded Samsung LAN release passed. The owner verified the
core Publish/Rollback flow and hosted v1/v2 pages from Mac Chrome.
The accepted H1 runtime remains the rollback baseline while H2 is
tested. H1 versions are restricted to two built-in HTML documents.

After H1 device acceptance: Package CMS, Termux environment controls,
secure Local Agent-backed AI API, multi-project adapters, arbitrary
code uploads, DNS/HTTPS, PhotoMap release work and autostart are separate
milestones. No current sprint item authorizes any of them.

## H2 — browser-owned multiple static sites: device accepted

H2 provides up to eight independently created static
sites, bounded ZIP/folder imports, individual loopback
ports, immutable releases, one-step rollback and
verified Start/Stop/Restart. It includes HTTP health,
bounded logs, process memory/uptime and local
deployment history. Private-LAN read-only site previews
reuse the existing gateway on port 18879.

**Samsung G2/G3: PASS.** Application source
`750c4b3fba2126647c3b593ae89d108ba2a67206`
passed full native `check:all` (26/26 UI tests).
The guarded H2 cutover created two real sites,
uploaded ZIP and folder bundles, served HTML/CSS/JS,
updated and rolled back a release and verified
service noninterference before cleaning test fixtures.

The next gate is the owner's actual Mac Chrome
interaction with one user-chosen uploaded site.
Device HTTP is not equivalent to owner browser
acceptance. No H2 autoservice, public tunnel, login,
Node/Python backend execution or package installation.

## H2.1 — archive selection and cleanup: source candidate

The owner accepted H2 in actual Mac Chrome with
two independently uploaded, working static sites
and confirmed quick rollback. H2.1 implements
on-demand version inventory with date/size/count,
read-only archived preview, restore of any retained
owned release and one-use rollback to the prior
active release. Archived deletion is explicit and
denies active or quick-rollback targets. The
hosted link spacing was adjusted.

**Source only:** exact-SHA Samsung QA and guarded
live acceptance pending. No user site restart, automatic deletion or migration is permitted.
See [H2.1 checkpoint](checkpoints/2026-11-07-h21-release-manager-source.md).

## H3 — reviewed Termux package/software CMS: next product milestone

Build a constrained package inventory and reviewed
installation/update plan, separate OS package upgrades
from project-local dependencies, require explicit
approval for mutations and prove safe rollback/
failure handling on a disposable owned fixture.
The six existing services stay unmanaged.

## H3 parallel feature branch — Termux Control Center

The isolated `feature/h3-termux-control-center-20261107` branch adds a
working four-tab administration candidate without a password prerequisite:

- **Packages:** reuse native `apt-get`, `dpkg-query` and `apt-cache`,
  including bounded full inventory, available package search, simulated
  install/remove/upgrade plans and user-confirmed execution.
- **Files:** display H2-owned active-release assets and provide a separate
  owned scratch workspace with navigation, text editor, rename, copy,
  import/export (128 KiB) and deletion.
- **Services:** reuse the verified H2 own-site lifecycle and logs. Inspect
  runit services and explicitly register non-protected, exact-target
  services before enabling Start/Stop/Restart/Unregister.
- **Backups:** create, list, integrity-verify, restore and delete H3
  workspace snapshots. Preserve the pre-restore workspace as a sidecar.
  Integrate the installed Restic CLI for encrypted local workspace backup,
  repository checks, snapshot listing, staged restore and forget/prune.
  H2 immutable releases remain version history, not system backups.

All four features are actual source code, not placeholders. No package or
service mutation is run during QA. Six protected Termux services and both
existing user-created sites remain unchanged. The current trusted-LAN panel
has no login, as explicitly requested by the owner. The H3 API uses typed
operations, origin/host checks and explicit per-target UI confirmations
without introducing an authentication requirement.

Independent system-wide or off-device backups, arbitrary Termux directories,
terminal exposure and AI agent API remain distinct integrations to evaluate
after native QA. Do not deploy this branch over the existing live panel
without a separate preservation gate. See the H3 checkpoint.

## H3.4 — Full Termux Administration (G3 deployed; test follow-up)

Owner-authorized continuation adds the full named-root File Manager,
manual single-client ttyd terminal, registered runit service autostart
and bounded logs, Restic HOME/PREFIX system backup with staging Restore,
and the typed Local Agent local-HTTP API adapter. No password setup is
a prerequisite. The trusted LAN and loopback trust boundary remains
mandatory; do not expose the terminal through public ingress.

H3.4 passed native Samsung G2 and its panel-only guarded
G3 cutover returned PASS for `main@e1c11e7`.
The two existing sites and six protected services were
preserved. The trusted-LAN panel now serves `/termux`.
Physical ttyd, disposable Restic recovery and browser
tests remain OPEN; ttyd was absent at cutover. Do not
claim all tools installed or full recovery accepted.

See [H3.4 checkpoint](checkpoints/2026-11-07-h34-full-termux-source.md)
and [ADR-0011](adr/0011-h34-termux-administration.md).

## H4 — authenticated agent API: later milestone

Extend the existing Local Agent transport with a
scoped, authenticated local API only after
threat modeling, identity, rate limits and audit
contracts. Do not expose an unrestricted shell.

See [H2 checkpoint](checkpoints/2026-11-07-h2-static-hosting-source.md)
and [development plan](DEVELOPMENT_PLAN.md).
