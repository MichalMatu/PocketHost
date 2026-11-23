---
status: deferred
owner: core
last_reviewed: 2026-11-23
purpose: Deferred selective upstream TermuxPanel reuse inventory
---

# Backlog: selective reuse from TermuxPanel (after Hosting MVP)

Source: https://github.com/himalayladha/termux-hosting-panel
License: MIT, Copyright (c) 2026 Himalay Ladha. Preserve copyright and license notices when copying any substantial code.

**Status: DEFERRED.** No installation, deployment, vendoring or import into PocketHost. Complete current Hosting MVP acceptance and basic stabilization first.

| Candidate | Later action | Notes |
| --- | --- | --- |
| HTML / Node.js / Python / PHP starter templates | Evaluate as examples for PocketHost's own starter catalog | Prioritize HTML and Node first; Python/PHP later. Verify contracts rather than copy directly. |
| Cloudflare Tunnel, DNS, custom domains | Compare API integration after local hosting has been accepted | Needs separate authorization for WAN / external tunnel / credential changes. |
| File manager and browser editor | Compare navigation and UX with current PocketHost File Manager and editors | Prefer existing PocketHost APIs, components and permissions. |
| Process manager, installer, watchdog | **Do not import** | TermuxPanel invokes `fuser -k`, `pkill`, installs cron watchdog and boot services. Incompatible with PocketHost process ownership/protected service policy and user's no-scheduler rule. |

Source reviewed: TermuxPanel README, `LICENSE`, `installer/install.sh`, `backend/services/process.service.js`, `backend/services/file.service.js`, `backend/services/cloudflare.service.js` (2026-11-17). Claims in README are project claims, not verified production reliability.

## Active PocketHost priority order (do not expand scope)

1. P0 Node: owner-authorized real app on Samsung A8 — Create / Stage / Prepare / Deploy / HTTP / Logs / Update / Stop-Start / Rollback. Preserve existing owner secret and check project-owned process identity.
2. P0 Static: active index.html edit / second release / content check / rollback of existing owned site.
3. P0 UI: confirm /hosting, /deployments and /runtime-logs reflect exact Static and Node inventory and deep links.
4. P1 Stabilization: backup/restore (real recovery) and reboot/autostart, **only with separate explicit owner approval**. After this, return to Cloudflare/custom domains/Python/PHP.

Execution policy: current `main` only; A8 Termux Local Agent for device operations; no scheduler, no Actions, no Codex/Work, no global QA. Fresh explicit scope authorization per test as in `AGENTS.md`. Do not mark physical acceptance from source commits or basic HTTP 200.
