# PocketHost Agent Instructions

## Scope

Applies to the entire repository. More specific `AGENTS.md` files refine these rules, but may not weaken safety constraints. Begin by reading `docs/README.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, and `docs/QUALITY_GATES.md`.

## Branch policy — main only

All PocketHost source, documentation, tooling, tests, architecture, checkpoints and
quality changes must be committed directly to the **current `main`** branch by
default. Do not create or work on feature, sprint, checkpoint or agent branches,
or prepare a PR branch, unless the owner explicitly names the exception and
its scope. Verify the fresh `main` HEAD before any edit and use non-force,
expected-HEAD writes.

## Product direction — Android power-user control via Shizuku (owner decision 2026-11-08)

**PocketHost is evolving into a full-featured power-user Android/Termux
management console.** The owner explicitly wants Shizuku as a first-class
integration and the broadest capabilities the Android device actually grants.
Do not impose product-level artificial ceilings such as a permanently
read-only Shizuku layer, arbitrary command-category bans, inaccessible
advanced features, mandatory full QA for each tiny edit or fixed
power-user feature whitelists.

ADB-backed Shizuku privileges are **not root**; operating-system permissions,
the Shizuku service lifecycle, Android app authorization and the actual
transport limit what can execute. Expose real capability/permission states,
clear user controls and direct user-triggered operations. Keep separation
between requested actions and autonomous mutation: no hidden execution,
unexpected WAN access, credential disclosure, forged privilege elevation or
silent interference with unrelated services. Dangerous actions may be
available to the power user by explicit target/action, with accurate
consequences shown rather than pretend permissions or blanket suppression.

Native Android companion / Binder integration is the long-term execution
path; a browser alone does not receive Shizuku Binder privileges. Begin
with the Shizuku UI hub and typed capability contracts. See
[ADR-0013](docs/adr/0013-shizuku-power-user.md) and
[Shizuku module](docs/modules/shizuku.md). This decision supersedes
earlier *product-scope* assumptions that the project must stay read-only
forever, not Android permissions or tool execution boundaries.

## Power-user UX — no artificial blockers (owner decision 2026-11-09)

**Build working capabilities first. Security hardening, credential management,
pairing, approval workflows and optional access policies are a separate final
phase**, not prerequisites or permanent obstacles in ordinary PocketHost DEV.
For an explicitly user-triggered Advanced Shell command in the owner-controlled
private-LAN panel, do **not** require a pairing code, QR challenge, repeated
phone confirmation, per-command approval dialogue or special product token.
The user's direct Run action is the intent to execute. Return actual Android
Shizuku ADB/root output or a genuine OS error; do not replace it with a
read-only placeholder.

Do not add arbitrary command allowlists, command-category bans, permission
grants or extra verification rituals to a power-user operation. The requested
operation remains limited by the **real** Android UID, available Shizuku
authorization, bounded program execution and the explicit target selected
by the owner. Never pretend ADB is root.

Postpone UX-facing security hardening until functional acceptance; design the
transport so authorization/TLS can be added without rewriting the feature.
This is **not** permission to expand the server to WAN, remove private-network
binding, execute commands automatically, leak secrets or modify unrelated
Termux services. Do not claim an unauthenticated HTTP shell is secure; document
that exposure as an explicit DEV-only risk. Preserve the owner-directed
no-autostart and process-ownership rules below.

## Active working mode — rapid DEV iterations (owner decision 2026-11-08)

PocketHost is a **development-only Termux control panel**, not a commercial
production service. The current working loop is **edit -> commit on main ->
minimal relevant check on Samsung -> refresh or restart the PocketHost-owned
DEV panel -> owner reviews -> next edit**. Do not invent extra preview
instances, approval rituals, per-change exhaustive audits, duplicated QA
checkouts or mandatory full builds for small UI changes.

Use `npm run dev:sync` once per active DEV session for UI-only GitHub-to-Samsung updates (see `docs/DEV_ITERATION.md`); no recurring Agent task per cosmetic commit. Use `npm run dev:quick` for route/navigation edits; `npm run dev:ui -- <test-file>`
when a focused interaction needs checking. Simple visual/CSS edits may be
reviewed directly in the live DEV panel. Run `npm run dev:full` only at
milestone closeout or when core/runtime/security changes justify it.
Never label an unrun test as PASS. See [DEV iteration runbook](docs/DEV_ITERATION.md)
and [ADR-0012](docs/adr/0012-private-ui-rapid-review.md).

**Normal refresh/restart of the existing, verified PocketHost-owned DEV panel
is permitted by the owner without another per-iteration approval.** It is
not a production G3 release. Verify exact process ownership before any
restart, never signal by name or port alone, and preserve rollback readiness.
Do not touch other Termux services, managed sites, Local Agent, package state
or public network exposure. Actual connector/host execution policy still applies.

Detached isolated QA checkouts on the designated Samsung Termux are allowed
to validate a specific `main` SHA; they are not working branches. Historical
branches may be deleted only after confirming all their commits are
reachable from `main`. Committing code to `main` does **not** authorize managed PhotoMap
activation, package mutation, autostart or public exposure. The separately
owner-authorized PocketHost-only DEV refresh/restart follows the fast-loop
rules above; public/product releases retain independent physical gates.

## Non-negotiable safety

- Never modify, restart, stop, rebind, expose, migrate, or replace existing Termux services including IleStoi.pl and Local Agent without an explicitly authorized operation for the specific target.
- Treat every discovered website or process as **externally owned** until PocketHost has an explicit ownership record; discovery is read-only.
- Keep the native Companion bridge on Android loopback. The existing owner-authorized **private-LAN gateway** binds one exact private IPv4 interface. Its DEV Android & Shizuku console explicitly includes the owner-requested **direct Advanced Shell**, without pairing or repeated approvals. Do not add WAN/public exposure, new wild-card listeners, or access to unrelated Termux services. This supersedes earlier read-only-demo assumptions about the LAN panel.
- No host-level filesystem scan outside agreed locations; no automatic package installation, tunnel creation, DNS modification, or process killing.
- Development is manual from CLI: do not add autostart, boot receivers, persistent services or scheduled tasks in DEV.
- Do not invoke GitHub Actions, Codex, or ChatGPT Work. GitHub Connector is for repository edits and private task transport. **All PocketHost development command execution, dependency installation, checks, tests, builds and compilation take place exclusively on the specifically addressed Termux phone through its installed Local Agent**. Do not run development commands on Mac or in a ChatGPT Linux sandbox. See `docs/LOCAL_AGENT_TERMUX.md`.
- Before importing the full admin template, run the existing foundation gate **on Termux through Local Agent**. Preserve all 30+ existing upstream screens and routes in the first admin candidate; no feature adaptation or unused-page removal. The imported admin app lives under `apps/admin` and is treated as a pinned upstream baseline with its own package-level lint/build gate.

## Agent execution handoff

At the start of a new session read `docs/LOCAL_AGENT_TERMUX.md`; select the **exact** Termux host and installation from fresh private control evidence, not a guessed or historic ID. The current Termux Local Agent profile is host-command oriented: do not assume automatic project checkout, a repository worker, or tool availability. Do **not** require PocketHost project binding or Agent project registration: CLI host tasks work independently. The exact Agent **host/installation** identity remains mandatory. Use an isolated ordinary Git checkout; never reuse IleStoi.pl or Local Agent directories. PocketHost itself starts only by an explicit Termux CLI command in DEV, not by device boot or Local Agent startup. Do not infer a successful run from a task publication alone.

## Architecture contract

Keep UI, discovery, service lifecycle, package installation, sites, config, diagnostics and future AI API independent, communicating through explicit typed interfaces. No module imports another module's internals or shells out independently; host commands belong behind the host adapter. See `docs/MODULES.md`.

## Changes and evidence

For small DEV UI changes, make a narrow, proportional check using the
commands in `docs/DEV_ITERATION.md`; do not routinely require
`check:foundation`, `check:all`, coverage, hardware matrices or complete
builds. Scope broader gates to milestone closeout or actual high-impact
backend/security changes. Record tested commit/command/result when run and
distinguish **unverified** from **PASS**. Never commit secrets, sensitive
host paths or live configuration. Only execute PocketHost checks on Samsung
Termux through Local Agent.

## Gate

Do not publish a public/product release with failing applicable gates.
An ordinary owner-visible **DEV panel restart is not that release**; use
proportional checks without artificial G0/G1/G2/G3 blocking on every
small change. Respect host-ownership safeguards and tool restrictions.
See `docs/QUALITY_GATES.md` and ADR-0012.
