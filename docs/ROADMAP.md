---
status: deferred
owner: product
last_reviewed: 2026-11-23
purpose: V1 freeze and concise restart plan for optional future releases
---

# PocketHost — post-v1 roadmap

**Current decision:** `v1.0.0` closes the accepted owner-operated private-LAN MVP. Preserve complete Git history. The release is a **source baseline**; it does not claim a later A8 device deployment or additional QA. No further work, tests, builds, redesign or deployment should start until the owner returns.

## When work resumes: v1.1

1. **Site traffic analytics (first sprint).** Review [TermuxPanel](https://github.com/himalayladha/termux-hosting-panel) `backend/services/analytics.service.js` and its analytics UI. Implement per-site request counts, HTTP status breakdown, bytes, top routes and bounded time-series/RPS. Prefer PocketHost's existing telemetry, release identities and Static/Node interfaces. Keep paths and client identifiers privacy-aware, bounded storage and limits, and avoid a second scheduler or process supervisor.
2. **SQLite Studio (second sprint).** Study upstream `backend/services/database.service.js` as a reference, but implement a **read-only**, per-owned-project database browser: discover explicitly scoped SQLite files, view tables/schema and paginated rows. Respect existing path/symlink/owner rules. No SQL console, arbitrary filesystem scan, database write/delete or live DB replacement in the first version.
3. **Application starters (later sprint).** Compare upstream HTML/Node templates with existing PocketHost create/import flows. Add only missing useful starter templates. Python/PHP runtimes are a separate scope and require new acceptance.

**Implementation rules:** one integrated PocketHost React/TS UI and host API, one runit-based owner/supervisor model, one paired A8 Local Agent QA/deploy path. Do **not** merge TermuxPanel's Express backend, terminal, watchdog, cron, backup engine or tunnel configuration. Evaluate MIT notice requirements before reusing actual code.

**Explicitly deferred:** off-device disaster recovery, physical reboot qualification, WAN ingress and untrusted-code isolation. These are not blockers for the accepted private-LAN MVP.

Start with [current handoff](HANDOFF_NEXT_CHAT.md), [architecture](ARCHITECTURE.md), [quality receipts](QUALITY_GATES.md) and [upstream review](UPSTREAM_REUSE_STRATEGY.md).
