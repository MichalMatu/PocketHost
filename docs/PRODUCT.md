---
status: accepted
owner: core
last_reviewed: 2026-11-09
purpose: Define product intent and MVP exclusions
---

# Product and MVP

## Problem

People can generate websites with AI but struggle to host them. PocketHost aims to make an Android phone running Termux an approachable web-hosting node, eventually with simple domains and AI deployment.

## Initial milestone: Inventory MVP

- Launch a local GUI **manually** from Termux CLI; no autostart.
- Show discovered local server processes, listening endpoints, installation paths where safely accessible and relevant package versions.
- Clearly distinguish **observed third-party services** from **PocketHost-owned services**; default to read-only inspection.
- Display unknown/unavailable values without guessing. Redact access tokens and secrets.
- Never disrupt IleStoi.pl, Local Agent or any existing service.

## Follow-on MVP: Own single-site server

- Add a PocketHost-owned test document root and HTTP server on a separately selected port; no collisions.
- Explicit start/stop of PocketHost's own server only; display logs and safe configuration options.
- No automatic deployment and no public management interface by default.

## H2 accepted — multiple personal static sites

PocketHost now manages up to eight explicitly created,
isolated static sites on the Android Termux host.
The owner can upload a bounded ZIP or Chrome-selected
folder containing HTML/CSS/JS/assets, publish
a new immutable revision, roll back the last
publication once, and inspect process health,
history, logs, memory and uptime. Each project
binds its own localhost port and can be manually
started, stopped or restarted.

The current interface is a trusted-home-LAN
development tool, **not an authenticated public
hosting product**. Site bundles do not execute
Node, Python, PHP or other backend applications.
The user's Mac Chrome file-picker acceptance
remains the last H2 UX confirmation.

## Future modular platform — approved target, not a delivered MVP

The owner subsequently approved **PocketHost = modular platform,
Hosting = orchestrator of modules**. After the accepted static H2,
the first dynamic milestone (M3) is a disposable Node.js app created
through PocketHost, using existing process/release contracts and
official Termux tools. SSH, Cloudflare, Python/PRoot and later
databases are independent reusable modules. The
[canonical roadmap](ROADMAP.md) and [reuse matrix](
UPSTREAM_REUSE_STRATEGY.md) override the initial-MVP exclusions
below for *future planned development*, not for automatic activation
of existing services.

## Historical initial-MVP exclusions

Commercial multi-tenancy, package installation through UI, public AI
deployment API, automated DNS/tunnels, payments, arbitrary uploaded
backend execution, Android APK packaging and service autostart were
excluded from the original inventory/static-site MVP. Later owner
decisions authorize **planning and separately tested implementation**,
not silent public exposure, package mutation or takeover of existing
IleStoi/Local Agent services.

## Definition of done

A feature is complete only when docs, negative cases, tests, rollback and local quality gates pass. Phone-specific claims require a read-only host preflight and recorded evidence; otherwise label as unverified.
