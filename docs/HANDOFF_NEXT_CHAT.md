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

- Latest verified A8 DEV: `54ea5624c7539d75d5e49cf5791a6bc8a49dfaaf`.
  Task `pockethost-a8-terminal-help-refresh-alignment-54ea562-20261120-v1`:
  **PASS**, HTTP **200**, owned PID **7552**, start ticks **55502910**,
  protected services unchanged, QA **NOT RUN**, no Termux packages installed.
- Scoped UI change: Terminal explains missing `ttyd` only when inventory says absent
  (with link to Packages); otherwise hides dependency/install guidance.
  Top-level Refresh moved to the upper-right on Sites, Network Access,
  Deployments and Projects; Termux pages use a two-column toolbar so
  Refresh remains right-aligned. Backend refresh actions unchanged.
- Browser QA/functional acceptance at this SHA **not performed**.
  Owner will install `ttyd` manually, then use Refresh in the panel.

## Verified A8 deployment

- Latest verified live A8 DEV source: `1444596a94545e4d0cf64e2bab9befbb28fd74e8`.
  Task `pockethost-a8-global-layout-file-1444596-20261120-v1`: **PASS**,
  HTTP **200**, owned PID **19103**, start ticks **55446241**,
  protected services unchanged, tests **NOT RUN**.
- Preceding A8 task `pockethost-a8-dashboard-battery-layout-a51d3e5-20261120-v1`:
  **PASS** at `a51d3e5`; removed transient battery notice from Dashboard
  while retaining the Battery card. Owner confirmed Dashboard stable thereafter.
- Current small UI fixes: stable shared scrollbar gutter and disabled global
  smooth scrolling; shell-shaped first-load fallback instead of a center-only
  spinner; File Manager equal-height bordered columns; explicit `ttyd` absent
  status and Packages installation steps. **ttyd has not been installed**.
- Prior A8 `9bae95a` fixes: initial theme paint; removed external Google Fonts;
  recoverable lazy page load errors; stable Dashboard card slots; Vite asset
  revalidation (API/HTML no-store); File Manager and terminal copy.
- **No browser QA or functional acceptance at `1444596`**. The user has
  reported layout shifting on multiple other pages, so broad browser
  confirmation remains open. Terminal needs a separately authorized package
  install before native Termux Bash can be started. Historical scoped QA
  at `5352c09` does not attest to this newer version.

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
