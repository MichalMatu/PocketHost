---
status: active
owner: core
last_reviewed: 2026-11-20
purpose: PocketHost latest A8 DEV source, Lab receipts and bounded resume path
---

# PocketHost — current handoff

Read [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md),
[the MVP tracker](MVP_EXECUTION_PLAN.md), [Test Lab](TEST_LAB.md)
and [Local Agent transport](LOCAL_AGENT_TERMUX.md).
The [18 November checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md)
is historical evidence, **not** the latest live SHA.

## Verified A8 deployment

- Current verified A8 DEV live source: `ff1559d85abdf45451886263ba003a7125dfa14d`.
  Guarded Local Agent task `pockethost-a8-appearance-theme-fast-flow-ff1559d-20261120-v1`:
  **PASS**, HTTP **200**, owned PID **23096**, start ticks **55007488**,
  protected services verified unchanged, tests **NOT RUN**.
- Current panel improvements: bounded/fail-closed reads in File Manager,
  Terminal, Backups & Recovery, Agents & API, Platform and Network Access;
  Appearance now uses the real browser-persisted theme provider instead of
  a no-op form. These changes were deployed sequentially with exact-SHA A8
  guard receipts; this is **deployment verification, not UI or functional QA**.
- Historical scoped QA at `5352c097246de249ac9d28a017135f4809d7e415`
  passed only its recorded syntax/format/structure/lint/Node categories.
  Earlier admin TypeScript checks were similarly SHA-scoped. None qualifies
  the current `ff1559d` code. Full G2, Hosting P0 browser acceptance,
  Services S1–S4 owner sign-off and reboot G3 remain open.

## Private Mac Test Lab

- Exception to A8-only execution: the paired MacBook Local Agent may run
  **owner-requested, read-only** Chrome screenshots, geometry and allowlisted
  GET probes on the trusted private-LAN panel. Mac never deploys or operates A8,
  executes source/project QA suites or writes panel settings.
- Latest source for this standalone development tool is included in current
  `main`; `scripts/test-lab/capture.mjs` uses one SPA page, isolated Chrome
  context and three viewports, with local-only screenshots and HTML/JSON reports.
- Mac Lab task `pockethost-lab-mac-spa-capture-c762ec3-20261119-v1`:
  **9/9 rendered, zero horizontal overflow and JS exceptions** against A8
  `f8ab416`; host/network GET responses were JSON and minimal shape PASS.
  Follow-up classified-network capture also rendered 9/9. Some other captures
  were incomplete during intermittent LAN/module loading, so no claim of
  universal reliability.
- First real geometry findings: undersized controls in the menu/search toolbar
  and Hosting links/buttons. These motivated `32ea32d` and `5351d88`.
- Post-deploy Mac Lab task `pockethost-lab-mac-vite-timeout-postdeploy-5352c09-20261119-v1`:
  **9/9 rendered views**, zero overflow/tiny targets/JS exceptions/failed
  same-origin requests, both GET API probes HTTP 200 and shape PASS.
  One external request was intentionally blocked and seven canceled.
  The 20-second GET/HEAD-only Vite asset timeout addressed the previously
  observed module import failure in this bounded run, not a universal guarantee.
- API mutation from Test Lab is **not implemented**. Scope-specific owner
  permission, allowlisted endpoint, before-state, independent readback and
  rollback are required before any safe mutation adapter.

## Execution boundaries and next work

1. Read latest `main` and independently check live SHA/owner before each A8 action.
   Source commits and QA receipts are **not** deploy receipts. Avoid racing
   parallel chats: if `main` or QA checkout moved, HOLD and reconcile.
2. Responsive Mac Lab observation after `5352c09` is complete: **9/9 PASS**.
   Next: prioritize authenticated, ownership-scoped, readback-and-rollback
   planning for isolated DEV settings fixture; **no arbitrary API writes**.
   Do not repeat broad A8 UI QA merely to collect errors.
3. Hosting P0 current-browser sign-off, Services S1–S4 owner acceptance,
   Android reboot/autostart G3, WAN/TLS, and off-device recovery remain open
   or deferred. Full G2/G3 has not been certified.

Only A8 handles guarded builds/deployment and on-device QA. No scheduler,
Codex/Work/Actions, unexpected SSH/WAN/Cloudflare changes, foreign-service
adoption, reboot, untrusted Node source or off-device Restic activity.
See [DEV iteration rules](DEV_ITERATION.md) and [quality gates](QUALITY_GATES.md).
