---
status: accepted
owner: core
last_reviewed: 2026-11-05
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

## Out of scope until later ADR

Commercial multi-tenancy, package installation through UI, public AI deployment API, automated DNS and tunnel, payments, arbitrary user-provided backend execution, Android APK packaging, OS startup integration.

## Definition of done

A feature is complete only when docs, negative cases, tests, rollback and local quality gates pass. Phone-specific claims require a read-only host preflight and recorded evidence; otherwise label as unverified.
