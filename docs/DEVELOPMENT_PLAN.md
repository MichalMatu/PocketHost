---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Delivery priorities for modular PocketHost and historical acceptance plans
---

# PocketHost Development Plan

## Current delivery priority — modular platform (2026-11-09)

**Reuse-first checkpoint (R0):** for every new feature, compare
existing PocketHost/owner code with official Termux tools, then
external maintained repositories. Prefer a typed adapter to
`runit`, `cloudflared`, Restic, `proot-distro` and native package
managers over copying engines. The [upstream reuse matrix](
UPSTREAM_REUSE_STRATEGY.md) records licenses, exact interfaces,
unsupported integrations and source-provenance requirements.
The first M3 Node Hosting MVP remains the priority. No large
open-source panel is imported wholesale.

The [canonical roadmap](ROADMAP.md) now prioritizes:
**M0 legacy decoupling -> M1 registries + components[] + SecretRef
-> M2 dependency plans + shared runit/health + backup/restore
-> M3 early Node.js Hosting MVP -> M4 SSH/Cloudflare/Python modules
-> M5 full multi-component orchestration -> M6 workload migration
-> M7 advanced expansion.** Historic O1/H2/H3 work below is
accepted evidence, not a competing delivery sequence.

**First working slice (M3):** one user-supplied disposable Node.js
project. Reuse H2 ownership and release/rollback infrastructure.
Implement a minimal browser Create Project flow, manifest and lockfile
inspection, project-local dependency plan, owned start/readiness,
staged update and rollback. Do not wait for Cloudflare, PRoot or
a complex multi-component wizard to validate the architecture.

**Shared foundations (M1/M2):** `ModuleRegistry`,
`ServiceRegistry`, `ProjectRegistry` and per-project
`components[]`, with distinct declared vs observed states.
One runit supervisor path, a separate policy evaluator for
health and bounded recovery, non-plaintext secret references
and a project-scoped backup/restore interface. Do not introduce
another process daemon or replicate IleStoi, Local Agent and
panel watchdog behavior as competing scripts.

**Acceptance:** each owned service must have one verified owner,
tested error/unknown behavior, actionable logs and no interference
with unrelated services. Each dynamic release must have a source
hash, readiness test, a previously working rollback target,
and a separate plan for mutable data/schema changes. Before any
IleStoi/Local Agent cutover require a successful disposable restore,
reboot and Wi-Fi/Android background recovery checks, and an
independent SSH/USB rollback route. Local Agent migrates last and
may not perform its own queued shutdown/cutover.

Existing Termux workloads remain independently supervised until
each individually approved, verified switch. Documentation edits
alone do not authorize service, key, package, tunnel or data changes.

## Active DEV sprint rhythm — 2026-11-08

For the current Termux UI redesign the normal path is small change,
`main` commit, narrowly useful Samsung check, HMR or PocketHost-only
DEV panel restart, owner feedback. No second preview or mandatory
full G2/G3 after each small adjustment. Full `check:all` occurs at
milestone closeout or before high-impact host changes. This active
[DEV workflow](DEV_ITERATION.md) supersedes older per-slice
full-acceptance language in historical plans; it does not waive
foreign-service protection or trusted-LAN restrictions.


The [roadmap](ROADMAP.md) is the canonical milestone sequence.
This plan defines how to deliver the next vertical slices.
Use only fresh `main`, GitHub Connector and the exact
Samsung Termux Local Agent; never GitHub Actions,
Codex, Work or Mac/Linux PocketHost execution.

## Baseline

- **P0-P2:** read-only six-service monitor and admin
  baseline accepted.
- **P3:** owned demo HTTP Publish/Rollback/Stop/Start
  accepted on Samsung; real browser interactions HOLD.
- **P4:** read-only PhotoMap TEST catalog and copied,
  stopped workset; live PRoot runtime not approved.
- **Generic runtime:** registry, process supervisor,
  PID identity guards, PRoot source plan, typed APIs
  and recovery dry-run. Last complete native application
  QA: `bc5e553`, 101/101 Node and 16/16 Vitest PASS.
- **Prior documentation gate:** `dcebf14` passed
  structure/docs/Markdownlint, but Prettier flagged
  three files. Do not claim that commit fully green.

## Sprint O1 — functional vertical slices

Implemented as a source candidate in `host`, `shared`, `observability`,
`apps/admin` and targeted negative tests. Sampling remains request-driven.
The `/observability` route and GET-only loopback development endpoint are
not production-exposed APIs. New source has **no completed native acceptance**
until the final exact-SHA Samsung result is recorded.

1. **Host Monitor — `host`:** CPU delta, RAM,
   storage, optional battery and network, runit;
   timestamp, provenance, missing-data handling.
2. **Process Inspector — `host`:** bounded,
   accessible process tree and resource statistics,
   verified ownership evidence separate from observation.
3. **Runtime Diagnostics — `diagnostics` and
   `runtime`:** reuse structured JSONL events,
   error categories, bounded history and dry-run
   recovery decisions.
4. **Package Inventory — `packages`:** read-only
   Termux, Node/npm and Python versions; show
   available updates only with valid safe metadata.
5. **Dashboard — `apps/admin`:** metrics, graphs,
   real states and actionable but non-mutating alerts.
6. **Aggregation — `observability`:** validate
   and summarize admitted snapshots behind typed
   contracts. The registered source module is initially
   a **contract shell**, not a running collector.

For each meaningful slice: typed contract, negative
tests, exact-SHA Samsung source validation and real
read-only device observations. Close with full
`npm run check:all`, UI/browser checks where
available and a completed-vs-blocked checkpoint.

## Out of scope

No process kill/adoption, package installation/upgrades,
automated recovery, new persistent services, Shizuku
setup, public command API or PhotoMap live activation.
Preserve the six foreign services and current loopback
ownership boundary. Keep P3 browser acceptance and
PRoot orphan recovery as parallel release blockers.

See [quality gates](QUALITY_GATES.md),
[ADR-0010](adr/0010-read-only-observability.md)
and [next-chat handoff](HANDOFF_NEXT_CHAT.md).

## Sprint H2 — multi-project user-owned static hosting

H2 is now the deployed, device-accepted successor to H1.
`sites` validates ZIP and folder uploads without extracting
untrusted paths; `host` owns explicit project markers,
dedicated loopback processes, immutable release directories
and PID/start-tick verification. `apps/admin` provides
typed creation/upload, deploy/rollback, lifecycle, logs,
memory and uptime. The existing private LAN gateway exposes
only verified GET/HEAD site previews on its separate origin.

No packages, uploaded backend execution, autostart, WAN
exposure, foreign service mutations or PhotoMap launch.
H2 controls additionally require `POCKETHOST_ENABLE_USER_SITES_DEV=1`
alongside the existing owned-demo DEV flag. This separate opt-in
prevents a new upload API from silently appearing after a source switch.
The final H2 application SHA `750c4b3` passed full Samsung
`check:all`, then the guarded G3 two-site ZIP/folder and
rollback LAN acceptance. The live preview is H2; H1 remains
the known rollback source. Browser ZIP/folder interaction
on the owner's Mac remains the next acceptance step.

## H2.1 — accepted H2 extension, source pending

The owner verified two independently hosted ZIP
projects and requested direct release selection.
The existing host adapter lists immutable versions,
checks exact-owned release contents, and changes
only the active marker for a selected restore,
retaining one-use undo. Unused archives can be
removed only by confirmed, exact-ID deletion
after refusing active/quick-rollback targets.
The site server adds isolated archived previews;
the admin view exposes these and fixes link spacing.

Do not disturb existing user projects or their
running PIDs. Source acceptance requires exact-SHA
Samsung `check:all` plus a controlled device LAN
release test and explicit Mac browser confirmation.
See [H2.1 checkpoint](checkpoints/2026-11-07-h21-release-manager-source.md).

## Next milestones after H2

- **H2 owner UI acceptance:** Mac Chrome create, actual ZIP/folder
  upload, Start, open static content, update and rollback.
- **H2 site lifecycle follow-up:** scoped deletion and safe
  release pruning for the eight-site and 16-release limits.
- **H3:** inspected and explicitly approved Termux software
  management, with per-package risk and dependency plans.
- **H4:** separately authenticated, scoped Local Agent-backed
  automation API. Never a public arbitrary host-command endpoint.

## H1 implementation — browser-driven owned Hosting MVP

H1 extends the accepted P3 one-site adapter instead of introducing
a competing supervisor. Module ownership:

- `host`: verified PID/start-ticks, exact `pockethost-demo` identity,
  HTTP instance-health probe, bounded durable release journal and
  fixed-file publication with metadata-failure content restore.
- `runtime`: existing explicit-owning policy; no inferred adoption.
  Serialized DEV action `restart` composes verified Stop and Start.
- `sites`: two prebuilt HTML releases only; one-step rollback,
  no upload, path, script, command, PID or port accepted from HTTP.
- `apps/admin`: project list, detail, deployments, logs, health,
  lifecycle controls, visible error/disabled states and confirmation;
  all upstream template routes retained and labeled.

The existing DEV feature flag `POCKETHOST_ENABLE_OWNED_SITE_DEV=1`
remains mandatory. The admin API stays bound to loopback and is reachable
only through the previously approved manual trusted-LAN gateway. There
is no login on that gateway; never enable it on untrusted networks.

Native acceptance must use one fresh exact-main SHA through the selected
Samsung Agent: negative tests, `npm run check:all`, actual controlled
HTTP cycle, verified own PID/start ticks before Stop/Restart, successful
one-step rollback, all six external services unchanged and PhotoMap 8010
closed. The LAN panel may switch only after G2 passes and a guarded
rollback plan validates its prior process identity.

Until a terminal result exists, source changes are **unverified**, and
the live UI must not be described as upgraded. Historic P3/O1 test
receipts remain valid for their exact earlier source only.
