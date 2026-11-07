---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Current milestones and the smallest safe next release gates
---

# PocketHost Development Plan

PocketHost is a manually operated Termux hosting control panel. Keep
UI, inventory, runtime, diagnostics, package management and future AI API
behind typed contracts and explicit ownership. Use only fresh `main`,
GitHub Connector and the exact Samsung Termux Local Agent; no new branches,
GitHub Actions, Codex, Work or device-wide package changes.

## Milestone status

| Milestone | Source and native scope | Release status |
| --- | --- | --- |
| P0–P2 | Foundation, read-only inventory, admin UI baseline | Accepted |
| P3 | Explicit owned demo lifecycle and versioned HTTP publish/rollback | Native/HTTP accepted; real browser G3 HOLD |
| P4 catalog | Stopped PhotoMap TEST import, GET-only catalog, copied rootfs/workset | Read-only accepted; live runtime HOLD |
| Generic runtime | Neutral registry, guarded process supervisor, PRoot plan/child evidence, typed schemas | Tested at `bc5e553`; live orphan/recovery HOLD |
| P4.next | Safe package inventory/plans and approvals | Deferred; installs/upgrades disabled |
| P5 | Scoped authenticated AI API, DNS/TLS, public access, APK | Deferred |

## Finished in the current source sprint

- Main-only consolidation and archive indexing; no obsolete branches remain
  in the accepted branch inventory.
- Application-neutral managed runtime registry and supervisor, with
  PhotoMap-specific profile/launch-plan kept outside the shared engine.
- Fail-closed PID/start-ticks/executable/cwd/argv and process/descendant
  guards, retained unknown start claims, diagnostic JSONL and dry-run
  recovery planning.
- P3/P4/host read-only API response validation and component a11y tests.
- Native `check:all` on `bc5e553`: 101/101 Node, 16/16 Vitest,
  coverage floor, lint, TypeScript, format and build PASS.
- Real P3 owned loopback Publish/Rollback/Stop/Start with unchanged
  external-service states. This is **not** browser click acceptance.

## Prioritized next work

1. **P3 browser gate:** test real click, keyboard and version-selection
   behavior, plus external-service and ownership readbacks. Current
   Chromium CLI render timed out; investigate safely on the device.
2. **PRoot recovery safety:** prove detached/reparented orphan handling,
   uncertain spawn and failed Stop; keep unknown claims and disabled
   PhotoMap inert until verified.
3. **Tooling:** optional Termux-compatible Knip audit, meaningful
   host/runtime coverage review and physical accessibility checks.
4. **P4 controlled runtime:** only after a separate explicit approval,
   use disposable copied data for physical Start/health/Stop and complete
   source/database/media rollback.
5. **Later product features:** package CMS and authenticated AI API only
   after the owned-runtime and release gates are closed.

Do not repeat accepted tests at an unchanged SHA or treat source coverage
as hardware acceptance. The [current handoff](HANDOFF_NEXT_CHAT.md) is
the operational entrypoint; exact receipts are in the
[final native checkpoint](checkpoints/2026-11-07-final-native-qa-handoff.md).
