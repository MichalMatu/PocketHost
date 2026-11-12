---
status: superseded-by-adr-0017
owner: core
last_reviewed: 2026-11-12
purpose: Retired standalone APK sprint sequence; historical product rationale only
---

# ADR-0016 — Retired S0–S10 APK sprint plan

**SUPERSEDED:** this S0–S10 standalone APK plan is historical.
[ADR-0017](0017-termux-first-single-app-integration.md) describes
a **deferred** future unified APK option. The active
[Termux-only Hosting roadmap](../ROADMAP.md) prioritizes complete
Node.js/GitHub Hosting, then Cloudflare, SSH, per-site analytics and
backup. Do not resume I0–I4 or S1/S2 runtime development.

The enduring product decisions are a single web panel and the
official Termux ecosystem. Basic and Pro are **technical dependency
categories, not free/paid tiers**. Basic must not depend on
Companion or Shizuku; the existing Android Pro code is frozen.

Full earlier text remains in Git history at
[ec2ed2a5](https://github.com/MichalMatu/PocketHost/commit/ec2ed2a5da4b4bba52a49b420c95ea85816d2dd1).
