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

## H2 — browser-owned multiple static sites: source candidate

Current H2 source supports eight independently created static sites,
with explicit project IDs, bounded ZIP/folder imports, per-project
loopback ports, immutable releases, one-step rollback, verified
Start/Stop/Restart, health, logs, metadata and resource statistics.
Trusted-LAN site previews use the existing separate GET-only 18879
gateway, never an additional public administration listener.

**No H2 release acceptance yet.** The complete exact-SHA Samsung
`check:all`, real uploaded HTML/CSS/JS lifecycle, negative security
cases and guarded live switch are mandatory. Until a terminal receipt,
H2 source must not be represented as running on the owner's phone.

H2 deliberately does not execute uploaded backend scripts or install
dependencies. Generic Node/Python/PHP runtimes, PhotoMap activation,
package CMS, authentication and public API access are separate
security-reviewed milestones.

See [H2 checkpoint](checkpoints/2026-11-07-h2-static-hosting-source.md).
