---
status: accepted-with-component-feasibility-gates
owner: core
last_reviewed: 2026-11-09
purpose: Evidence-led GitHub reuse matrix and integration gates for the modular Termux hosting roadmap
---

# PocketHost — Reuse Existing GitHub Solutions First

## Decision and limits

**Current implementation priority:** use this as a reuse catalog,
not a to-do sequence. Follow the [canonical roadmap](ROADMAP.md):
(1) Node.js Hosting + GitHub end-to-end, (2) panel Cloudflare,
SSH, per-site web traffic analytics and Restic backup. Basic
uses only official Termux; Pro requires optional Android helpers.
Defer APK integration, Companion/Shizuku changes and menu redesign.

**Prefer existing, maintained Termux tools and small reusable interfaces
to writing new daemons, installers, watchdogs, backup engines or web
terminals.** Integrate them through a typed PocketHost host adapter.
A third-party repo is **not** evidence that its code is correct,
compatible, sufficiently maintained, or authorized for copying.
Current approval is **documentation and evaluation only**: do not
install anything, import code, change service ownership or publish
routes merely because it appears in this matrix.

The PocketHost UI/backend remains JS/TS. In DEV its native tools run
as independently installed Termux CLI packages. For the target **one
APK**, reuse the upstream Termux Android application/bootstrap/packages
and adapt the existing Companion with relevant upstream API/Boot code;
this is source integration, not reimplementation of Git, SSH, apt,
Node.js, runit or a parallel package feed. Keep the official package
prefix wherever feasible, and never silently swap the active signed
Termux install. See [ADR-0017](adr/0017-termux-first-single-app-integration.md).

Source copying must be deliberate: pin exact upstream versions, account
for GPLv3 and other licenses, preserve notices and publish required
source when distributing derivatives. Shizuku's authorization and
Android's signature/permission boundaries still apply.

This inventory is based on public GitHub repositories/docs checked on
2026-11-09. Licenses are GitHub metadata and README statements, not
legal clearance. Recheck their exact chosen commit/tag and terms
before vendoring or redistributing; no new dependency is accepted
without a focused Samsung Termux compatibility and ownership gate.

## A — Reuse installed upstream utilities through official interfaces

| Upstream and license                                                                                   | What PocketHost should reuse                                                                                             | Implementation boundary / acceptance                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [termux/termux-services](https://github.com/termux/termux-services) — GPL-3.0                          | Installed `runit`, `service-daemon`, `sv status/up/down`, `sv-enable`/`sv-disable`, `down` marker, standard service logs | Build **one verified-owner** `SupervisorAdapter`; never embed/copy upstream scripts or add a parallel watchdog daemon. Existing external runit services remain protected                                                     |
| [termux/termux-boot](https://github.com/termux/termux-boot) — GPLv3 per README                         | Reuse existing DEV boot behavior; adapt its receiver logic inside the future unified APK                                 | Owner-opted startup of PocketHost-owned services only, with Android foreground/boot restrictions and reboot testing                                                                                                          |
| [termux/termux-packages](https://github.com/termux/termux-packages) — mixed/no single SPDX declaration | Official Termux package recipes and installed `pkg`/`apt`/`dpkg-query` utilities                                         | Use **runtime installed-version probes** and package plans. Do not copy package recipes wholesale, use Debian/Ubuntu assumptions, or run global upgrades as a side effect of deploy                                          |
| [cloudflare/cloudflared](https://github.com/cloudflare/cloudflared) — Apache-2.0                       | Existing binary, locally managed tunnel config; `tunnel ingress validate` and `tunnel ingress rule`                      | Cloudflare module edits **staged config only after explicit action**; preserve the current externally owned tunnel and never start a duplicate. Hosting only requests route bindings                                         |
| [restic/restic](https://github.com/restic/restic) — BSD-2-Clause                                       | Existing encrypted backup/snapshot/check/restore commands                                                                | Reuse a single typed Restic adapter with exact exit-status checks, credentials outside logs, retention locks, and a disposable restore acceptance. Do not invent a second archive-based backup product                       |
| [termux/proot-distro](https://github.com/termux/proot-distro) — GPL-3.0                                | Installed CLI lifecycle, `run` and container backup/restore where actually supported                                     | Optional Python/PRoot adapter; **not** a Docker daemon or secure kernel/container boundary. Check Termux ABI, process descendants, mounts, data and actual target support                                                    |
| [tsl0922/ttyd](https://github.com/tsl0922/ttyd) — MIT                                                  | Optional packaged browser terminal / WebSocket front end                                                                 | Reuse binary only **if it works on the actual Samsung**. PocketHost H3.4 recorded native ttyd SIGSEGV in prior tests: leave this path BLOCKED until a new minimal one-session physical check. Never expose terminal publicly |
| [termux/termux-api](https://github.com/termux/termux-api) — GPLv3 per README                           | Reuse needed Android API components and preserve existing termux-* commands where possible                               | Integrate into the future PocketHost Android app after per-command IPC, signature, permission and license tests; no fake privileges                                                                                          |

**Licensing stance:** Existing external CLI packages and an Android APK
that incorporates GPLv3 Termux source have different distribution
obligations. An integrated build must resolve GPL compatibility,
corresponding-source delivery, upstream notices and the PocketHost root
license **before** shipping. No vendoring or derivative release has
been authorized merely by this architecture decision.

## B — Take narrow design patterns; do not transplant whole platforms

| Upstream and license                                                                            | Reusable design                                                                                                                                  | Why no direct wholesale copy                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [piku/piku](https://github.com/piku/piku) — MIT                                                 | Minimal Heroku-like create/deploy, `Procfile` process roles, per-app environment/dependencies, release steps, low-resource simplicity            | Python/Linux/nginx/uWSGI-oriented; implement only compatible semantics in PocketHost JS/TS, backed by Termux runit                                                                                                                           |
| [himalayladha/termux-hosting-panel](https://github.com/himalayladha/termux-hosting-panel) — MIT | Real Termux-specific Node/Python/static project templates, separated control/data planes, Cloudflare configuration UX and package/status screens | Relatively new/small project; code inspection found direct shell-command string construction in backup handling and string-prefix filesystem checks. **Do not copy controllers or security checks** without independent test and remediation |
| [inchei/tdash](https://github.com/inchei/tdash) — GPL-3.0                                       | Compact runit health/status display and truthful Android permission/missing-counter fallback; bounded refresh approach                           | Source copying would trigger GPL analysis; very small/new project. Learn UI/probe patterns only; preserve PocketHost's Shizuku and host adapter separation                                                                                   |
| [coollabsio/coolify](https://github.com/coollabsio/coolify) — Apache-2.0                        | Project/source/release UX, environment variables, backup status, reusable service templates and deployment events                                | Requires Docker infrastructure on supported Linux; **not** a Termux installation or backend dependency. Use only a deliberately small subset of UX/process concepts                                                                          |
| [dokku/dokku](https://github.com/dokku/dokku) — MIT                                             | Minimal deployment lifecycle and plug-in concepts                                                                                                | Docker-powered Linux PaaS, inappropriate as a new Android/Termux process supervisor                                                                                                                                                          |
| [elkom14a/terwo](https://github.com/elkom14a/terwo) — license not declared in GitHub metadata   | Simple local-web-panel workflow for Node/PHP/static/Go server startup                                                                            | Treat as **ideas only**: absent verified redistribution permission, do not copy source                                                                                                                                                       |

These projects are _references_, not accepted upstream dependencies.
Prefer a maintained official Termux package or previously verified
PocketHost implementation over a small unproven server dashboard.
Treat copy-paste from tutorials and source snippets as code import
subject to the same license, sandboxing and security checks.

## C — Existing PocketHost and owner projects come first

| Capability            | Reuse already available                                                                                  | Avoid                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Static apps           | PocketHost H2 `SiteFleetHost`, file validation, immutable releases, rollback and owner markers           | Rewriting static hosting to match a third-party dashboard                             |
| Process identity      | PocketHost typed managed runtime registry and exact-owner PID/start-ticks/argv guards                    | Approving a process based on port/name or untrusted service directory                 |
| Termux package status | Current `dpkg-query`/`apt-cache` inventory and existing H3 administration                                | A second package manager or unreviewed global `pkg upgrade`                           |
| Admin panel recovery  | PocketHost-owned panel runit service/watch policy                                                        | Changing external `sshd` or `cloudflared` as collateral damage                        |
| IleStoi               | Existing `wreckscanner.run`, healthwatch origin/public/internet decision logic, lock-aware Restic backup | Blind public-error restarts, replacement of production data, competing SQLite writers |
| Local Agent           | Immutable bundle, durable claims and UNKNOWN/no-replay, separate private runit/boot and emergency stop   | Duplicate Git consumer or an Agent job that terminates its own executor               |

**Most reusable code is already in these three owner repositories.**
M0 must inspect them and map their tested behavior into PocketHost
contracts before selecting external alternatives. Do **not** auto-adopt
their currently running processes.

## Proposed minimal vertical slices / upstream-first work items

1. **R0 (M0):** make an inventory table of every planned feature:
   _existing PocketHost implementation_ -> _existing owner project_
   -> _official Termux/third-party CLI_ -> _new PocketHost glue_.
   Record upstream repository, exact revision/package version,
   SPDX/license, whether code or executable is reused, security
   boundary, native availability, maintenance check and tests.
   **No feature proceeds as custom code before its reuse decision.**
2. **R1 (M1/M2):** thin `ServiceAdapter` for existing Termux
   `sv` with positive ownership, dry-run status, manual-disable
   preservation and log capture. A shared health evaluator supplies
   policy, while runit remains the single supervisor. This replaces
   duplicate scripts, **not** the existing live service definitions.
3. **R2 (M2):** connect existing Termux package inventory, exact
   dependency manifest checks, existing Restic CLI and private
   credential references. Use native `npm ci`/Python `venv`
   instead of writing installers or a dependency solver from scratch.
4. **R3 (M3):** one newly created disposable Node app with simple
   `package.json` and optionally explicit `Procfile`-like
   start/release roles; H2 releases/rollback; runit owner-aware
   launch and honest readiness. No Docker, external tunnel,
   automatic acquisition of existing sites or second watcher.
5. **R4 (M4/M5):** independent SSH/Cloudflare module UI built on
   installed tools. Validate staged Cloudflare ingress before
   explicitly switching any route. Use `proot-distro` optionally
   rather than embedding a Linux environment; web terminal only
   after ttyd native crash gate.
6. **R5 (M6):** verified recovery rehearsals on disposable copied
   data, power/Doze/Wi-Fi and independent operator recovery;
   migrate IleStoi and Local Agent **one by one**, with the
   original production services retained until each PASS.

## Adoption checklist and stop conditions

Before any imported source or CLI integration:

- Pin an **exact tag/commit or verified installed package version**;
  note license/NOTICE obligations and obtain compatibility review.
  For a repo with **no confirmed license**, do not copy its code.
- Verify Android/Termux path/ABI, command flags, Android restrictions,
  physical Samsung compatibility, resource/battery cost and upgrade path.
  A Linux `systemd`, Docker or regular `/usr` assumption does not
  translate directly to Android Termux.
- Use argument-array subprocess invocation, explicit target IDs,
  bounded time/output, canonical path containment, atomic
  configuration staging and redacted logs. Do not copy another
  panel's `exec` strings, prefix-path checks or generic shell endpoints.
- Compare before/after service owner identity, existing site
  integrity, lock/port assignments and `down` markers. Reject
  external/unknown mutations and duplicate runit entries.
- Add a focused negative test for command and path injection,
  interrupted install, package mismatch, service not running,
  concurrent config change and failed release/restore as relevant.
- Mark **proposed / source integrated / Samsung tested / live
  accepted** separately. Documentation and public GitHub code
  are not device PASS.

R0/M0 reuse analysis remains background evidence; **do not restart
that audit**. Next implementation follows the two P0 Hosting tasks in
[ROADMAP](ROADMAP.md). GitHub import, Cloudflare ingress, SSH and
per-site web analytics are part of complete Termux-only Basic;
Python/PRoot and additional native Android integration are later.
