---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-06
purpose: Track milestone ownership, current release holds and the next bounded delivery
---

# Development Plan

All source execution and validation run on Samsung Termux through its
[installed Local Agent](LOCAL_AGENT_TERMUX.md), never via Mac, Linux sandbox,
GitHub Actions, Codex or ChatGPT Work. The canonical live status is
[the handoff](HANDOFF_NEXT_CHAT.md); historical evidence is in
[the archive](checkpoints/README.md).

## P0 — foundation (accepted)

Module ownership, manifest-controlled structure, security model, native
quality gates, pinned admin dependencies and source/documentation policies.

## P1 — read-only inventory (accepted)

Fixed allowlist of six external services, sanitized Termux status and
DEV-only typed host snapshot. No adoption or modification of foreign services.

## P2 — admin GUI (accepted baseline)

Desktop-first React/Vite Base UI dashboard with preserved upstream routes,
host health and appearance interactions. Production branding and a11y
remain ongoing; no public admin exposure.

## P3 — single owned test site (candidate, release HOLD)

Fixed isolated static demo with manually requested Start/Stop, sample
Publish/Rollback, and independently reviewed optional trusted private-LAN
gateway. Native device/HTTP and browser viewing passed. Real Mac browser
Publish/Rollback clicks and final protected-service readback are outstanding.
Source has been consolidated on `main`, but **production release remains blocked** until this gate closes.

## P4 — managed PhotoMap TEST (read-only accepted; runtime HOLD)

The original PhotoMap data/source and backup stay outside management.
Read-only catalog, GET-only API, independent imported copy, Debian 12 rootfs,
independent working SQLite and required Python tools are verified.
The selected runtime profile is disabled and unapproved; no live service
or automatic runtime lifecycle is accepted.

**Next source task:** negative tests and safeguards for forged ownership,
PID reuse/start ticks, executable/cwd/argv, PRoot child identity, port
collision, timeout, orphan cleanup and idempotent Stop. Do not re-copy
existing data, rootfs or media. A bounded real Start/health/Stop on the
independent working copy needs separate explicit authorization.
Whole-instance recovery and dependency planning come only after safe
real lifecycle acceptance.

## P4.next — packages and assisted operations (deferred)

Provide read-only tool versions, reviewed install/upgrade plans,
explicit approvals and rollback evidence. No implicit package installation
or global Termux upgrades during inspection. Separate local app data from
host-managed dependencies.

## P5 — AI-facing API, domains and Android distribution (deferred)

Build a **scoped, authenticated capability API** on top of the existing
Local Agent execution/admission/result machinery, not an arbitrary
public shell endpoint. Versioned deployment, manifest validation, health,
safe rollback, DNS/TLS, quotas and opt-in ingress require their own threat
model and on-device hardware tests. Keep Termux upstream; APK packaging is
a later UX layer, not a reason to fork it.

## Release order

1. Accept P3 actual browser mutations and external-service invariants.
2. Finish P4 negative ownership/orphan safeguards on exact tested source.
3. Separately approve one bounded physical PhotoMap lifecycle on disposable data.
4. Verify complete source/DB/media rollback, then consider managed package controls.
5. Review security and monitoring before exposing AI/remote management.

All future PocketHost changes are committed to fresh `main` by default. The 2026-11-07
fast-forward did not waive P3 browser release gates. Do not repeat accepted
Samsung tests or create new branches without explicit owner direction.
