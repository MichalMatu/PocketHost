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

## 20 November 2026 — A8 Agent 7415454 production cutover ACCEPTED

- Native source QA `sprint-a8-741-native-qa-clean-source-20261120-v1`: **29/29 tests PASS**, exact candidate bundle **26/26 SHA-256 PASS**, no Agent/SSH service changes during QA.
- One-shot external controller: first `prepare` failed pre-mutation because `operator.py` shadowed stdlib; corrected isolated Python invocation `python3 -I -B` **PREPARE PASS**. `sprint-a8-741-independent-switch-20261120-v1`: **SWITCH PASS**, Agent PID **4112 → 6821**, SSH PID **6596** preserved, rollback baseline stored.
- Independent fresh A8 task `sprint-a8-741-new-runtime-git-accept-20261120-v1`: **done/exit 0**, installed release `7415454b1fb2af7d3babe1c283c9e38848291d2b`, live PID/source, 26/26 manifest, STOP absent and SSH unchanged. Do not replay the switch.
- PocketHost DEV remains at `cec1a94e12a330e89f672f8d4ca1776cc3c7d2e9`, prior deployment HTTP **200**, PID **25941**; this is not browser functional acceptance. **Control & SSH**, Start/Stop, Pause/Resume, saved profiles, terminal and real raw console still need owner browser sign-off. No further tests or panel restarts performed with this docs change.

## Earlier 20 November 2026 — resumed A8 Local Agent + SSH sprint

- **SSH recovered**: native A8 task `sprint-a8-dedicated-ssh-restart-20261120-v1`
  verified port **192.168.0.16:8022 OPEN**, SSH process changed from PID
  4910 to 6596, Agent PID **4112** unchanged. Mac independent strict-SSH
  preflight `sprint-a8-mac-strict-ssh-preflight-741-20261120-v1` PASS
  (private host key pin, exact host identity, old runtime, no STOP, no
  unresolved local claims, 26-file candidate hashes).
- **PocketHost DEV deployed**: `cec1a94e12a330e89f672f8d4ca1776cc3c7d2e9` by
  `sprint-a8-ui-controls-ssh-20261120-v1`, terminal **DEPLOY PASS**
  (owned PID **25941**, start ticks **61554828**, HTTP **200**,
  external services unchanged, **PocketHost QA NOT RUN**).
  `Control & SSH` shows A8 status, local tasks/results, independent
  Start/Stop and (when supported) Pause/Resume, SSH restart, saved profiles
  and a browser ttyd terminal. Browser functional sign-off remains OPEN.
- **Agent release remains at `228489788d1e5c5045904ade95a2c50d791d20c9`**;
  candidate `7415454b1fb2af7d3babe1c283c9e38848291d2b` is present and
  hash-verified, with the owner-requested full raw `[CMD]` emitter plus
  safe intake pause. Independent Mac-native QA task
  `sprint-a8-741-native-qa-clean-source-20261120-v1` is
  **QUEUED / no receipt yet**, so no switch or claim of full emitter
  acceptance. Keep old runtime, STOP absent, rollback intact. Mac status
  reported stale/unverified host-claim state; do not replay the queued QA.
- **P0 owner rule remains:** trusted private LAN; no new authentication,
  token/redaction/security sprint unless explicitly requested.

## 20 November 2026 — owner-requested raw Local Agent console

- A8 PocketHost DEV **DEPLOY PASS** at `8fa67fcbed7d51194246cf86d19f5635205ef3d0`,
  task `pockethost-a8-raw-svlogd-console-8fa67fc-20261120-v1`.
  Guarded exact-source readback: owned PID **17717**, start ticks **60357296**,
  HTTP **200**, protected services unchanged, **tests NOT RUN**.
- The Live console now reads and displays actual binary bytes from the installed
  Termux Agent's fixed `svlogd/current` file. A 256-KiB cursor stream
  reconstructs the entire current file and follows future bytes every 5s,
  including original timestamps, commands and line breaks. No parser,
  categories, sanitization, inferred timestamps or auth tokens.
- Agent source `9ff0befc18cca4e257fab90ed342604c71824a6d` adds opt-in
  Termux-only complete `[CMD]` output and original task IDs. **Source only,
  not yet running on A8:** external Mac SSH task
  `galaxy-a8-raw-command-log-stage-9ff0bef-20261120-v1`
  (candidate package + native QA) is queued; separate operator preparation
  `galaxy-a8-raw-log-operator-baseline-inspection-20261120-v1` queued.
  Never claim the new Agent is installed before independent switch and
  fresh host Git task/result. Prior accepted runtime `2284897` remains live.
- The owner explicitly deferred all new security, authentication, tokens and
  redaction work to a **separate sprint**; follow root AGENTS P0.
  Browser visual/functional sign-off for the new raw console remains open.

## 20 November 2026 — A8 Local Agent log UX deployment

- PocketHost A8 DEV latest **PASS**: `fcbc2734094f41846eea43867d67a922a05a8f8a`,
  immutable A8 task `pockethost-a8-legacy-log-kind-fcbc273-20261120-v1`,
  guarded HTTP **200**, owned PID **10972** / start ticks **59813053**,
  protected services unchanged; **tests NOT RUN**.
- Prior A8 task `pockethost-a8-agent-task-stage-log-342edded-20261120-v1`
  deployed `342edded8f2584e45e7891099538296c02865558` **PASS**,
  HTTP **200**, owned PID **4593** / ticks **59796933**, QA not run.
- Legacy `exec`, `exec finished`, `output summary` now display under
  **Tasks** rather than generic **Service**. New Termux `TASK`, `STAGE`
  and `GIT VERIFIED` records are parsed as structured activity.
- **A8 Agent installed and Git-accepted:** exact runtime source
  `228489788d1e5c5045904ade95a2c50d791d20c9`; 26 native tests PASS,
  independent guarded switch PASS, fresh host Git task/result done/0.
  Independent SSH verified actual TASK/STAGE/GIT VERIFIED records in svlogd.
  Browser console acceptance remains OPEN.
- Historical status only: superseded by the owner-requested raw
  private-LAN console at `8fa67fcbed7d51194246cf86d19f5635205ef3d0`. Browser acceptance remains OPEN.

## Latest verified A8 DEV — Local Agent live log (20 November 2026)

- Task `pockethost-a8-agent-live-log-fb3dcc0-20261120-v1`:
  **DEPLOY PASS** at source `fb3dcc0ed47e006e5ea370ef96854d0b7b6e43c0`,
  exact owned SHA, PID **7894**, start ticks **59625188**, HTTP **200**,
  protected services unchanged; **QA NOT RUN**.
- Local Agent console reads up to 120 recent private svlogd records. Safe Linux
  Core execution fields are reconstructed in order, including command digest,
  exit status, elapsed time and output character count. Unknown/private log
  payloads are masked rather than exposed to unauthenticated LAN clients.
  Browser event-log tail continues visible-page polling every five seconds.
- User browser visual/function sign-off remains **OPEN**; guarded HTTP
  readback does not prove that log entries display correctly in Chrome.
  No lifecycle controls, raw remote command output or public log endpoint.

## Latest verified A8 DEV — 20 November 2026

- Local Agent task `pockethost-a8-local-agent-single-snapshot-b8c5f15-20261120-v1`:
  **DEPLOY PASS** at `b8c5f153db82f1716caa2d62326ffba8fdc79649`,
  guarded readback HTTP **200**, owned PID **27018**, start ticks
  **59407941**, protected services unchanged, **tests NOT RUN**.
- The read-only Local Agent screen and advanced details share one bounded
  control-plane API sample. Opening details no longer issues a duplicate GET.
  Stale diagnostic snapshots and paused browser event updates are labeled.
  UI regression assertions were changed in source but not executed. Owner
  browser acceptance remains open.
- Previous Local Agent UX deployment at `1399087825eb5c5554427ccce3df8d529f3b5c3a`:
  **DEPLOY PASS**, HTTP **200**, PID **27966**, start ticks **59321015**,
  protected services unchanged, tests NOT RUN.

## Verified A8 deployment

- Earlier verified A8 DEV source `83ada7caa6762aec0e0626f6290cfeff583a8fff`,
  task `pockethost-a8-phone-settings-ux-83ada7c-20261120-v1`:
  **DEPLOY PASS**, HTTP **200**, owner PID **24775**, start ticks
  **55819808**, protected services verified unchanged, QA **NOT RUN**.
  Owner screenshot-driven Phone Settings UI improvement: the connection/error
  message is now inside the Display & screen card instead of above it;
  bridge unavailable is labeled "not verified" rather than claiming Shizuku
  is missing; disconnected, unauthorized and settings API errors have
  distinct guidance; previous samples no longer imply live data; brightness
  and screen-timeout controls/labels are aligned with a consistent select
  height/chevron, and descriptions are concise. No Android operations,
  package installations or settings behavior changes. Browser visual
  acceptance remains open.


- Latest verified A8 DEV source: `425ea80155dac58d9f2e47f095a11c077c31f7f8`,
  task `pockethost-a8-shizuku-guarded-actions-425ea80-20261120-v1`:
  **DEPLOY PASS**, loopback HTTP **200**, owner PID **28660**,
  start ticks **55740887**, protected services verified unchanged,
  QA **NOT RUN**, zero Android device commands or package installations.
  UI safety sprint: confirmation prompts before app disable/uninstall/force-stop,
  permission grant/revoke, process TERM and Android service start/stop;
  launch separated from disruptive app controls; stale inventory view-only;
  mutation results trigger fresh bridge and inventory verification; Android
  Shell input/execution/history replay disabled without current authorized
  connection; diagnostics distinguish disconnected, unauthorized and bridge
  API unavailable. Installation is explicitly **unverifiable** from the browser.
  Functionality still requires physical Shizuku/Companion testing; user only
  approved visual UX previously.


- Latest verified A8 DEV live source `1bae685ea9ec69d43b7c2d139562601773581599`,
  task `pockethost-a8-shizuku-search-diagnostics-1bae685-20261120-v1`:
  **DEPLOY PASS**, HTTP **200**, owned PID **27171**, start ticks
  **55646275**, protected services unchanged, QA **NOT RUN**.
  Read-only visual UX update: one icon-bearing Shizuku search field design
  for apps, permissions, processes and services; Diagnostics action moved
  into header; connection status/API checks/native capabilities visually
  separated. No Shizuku installation, Android operation, API behavior change,
  physical QA or browser acceptance. User screenshots showed earlier
  inconsistent search fields and an empty action-button row.


- Latest A8 DEV live source `5c6ccd4bb5c8b43f7ab1563de38d0a7a691fe66a`,
  task `pockethost-a8-centered-root-loading-5c6ccd4-20261120-v1`:
  **DEPLOY PASS**, HTTP **200**, owned PID **32581**, start ticks
  **55572565**, protected services unchanged, QA **NOT RUN**.
  Reviewed screenshots at /settings/appearance: first-load fallback
  positioned the loader at top-left inside the content pane. Corrected
  the shared layout's center alignment, inline spinner geometry, and fallback
  viewport sizing. Reviewed loading patterns across primary PocketHost screens;
  local inventory/operation loaders stay within their sections.
  Browser rendering remains unconfirmed until owner verification.

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
