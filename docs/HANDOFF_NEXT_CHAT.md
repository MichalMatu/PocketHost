---
status: active
owner: core
last_reviewed: 2026-11-19
purpose: PocketHost latest A8 DEV source, Lab receipts and bounded resume path
---

# PocketHost — current handoff

Read [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md),
[the MVP tracker](MVP_EXECUTION_PLAN.md), [Test Lab](TEST_LAB.md)
and [Local Agent transport](LOCAL_AGENT_TERMUX.md).
The [18 November checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md)
is historical evidence, **not** the latest live SHA.

## Verified A8 deployment

- Current verified A8 DEV live source: `5351d88caa98814449becee8f27fbe16ecccfc50`.
  Guarded Local Agent task `pockethost-a8-guarded-touch-targets-5351d88-20261119-v1`:
  **PASS**, HTTP 200, owned PID **15342**, start ticks **54103228**,
  protected services unchanged. This attests panel safety, **not** all hosted-project readiness.
- Prior A8 live `f8ab416` and guarded deploy PASS introduced responsive
  tablet offcanvas navigation. `5351d88` adds larger mobile header and Hosting
  touch targets while preserving the earlier changes.
- A8 scoped checks for `32ea32d` and `5351d88`: **PASS** for changed-file
  formatting and admin TypeScript. The broader UI suite at `f8ab416`
  hit a 300-second timeout; **do not call full G2 PASS**.
  The `5351d88` UI interaction test exists in source but was not separately run.

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
- API mutation from Test Lab is **not implemented**. Scope-specific owner
  permission, allowlisted endpoint, before-state, independent readback and
  rollback are required before any safe mutation adapter.

## Execution boundaries and next work

1. Read latest `main` and independently check live SHA/owner before each A8 action.
   Source commits and QA receipts are **not** deploy receipts. Avoid racing
   parallel chats: if `main` or QA checkout moved, HOLD and reconcile.
2. Finish one-shot Mac browser geometry after `5351d88`; fix only reproduced
   UX defects. Do not repeat expensive broad A8 UI QA merely to collect errors.
3. Hosting P0 current-browser sign-off, Services S1–S4 owner acceptance,
   Android reboot/autostart G3, WAN/TLS, and off-device recovery remain open
   or deferred. Full G2/G3 has not been certified.

Only A8 handles guarded builds/deployment and on-device QA. No scheduler,
Codex/Work/Actions, unexpected SSH/WAN/Cloudflare changes, foreign-service
adoption, reboot, untrusted Node source or off-device Restic activity.
See [DEV iteration rules](DEV_ITERATION.md) and [quality gates](QUALITY_GATES.md).
