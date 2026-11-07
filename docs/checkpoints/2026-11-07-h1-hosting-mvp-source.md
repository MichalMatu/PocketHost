---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Record H1 source, Samsung acceptance, guarded LAN release and owner Chrome evidence
---

# PocketHost H1 — browser-managed Hosting MVP source

## Objective and isolation boundary

Provide one functional, explicitly owned app on Samsung Termux from the
browser without typing CLI commands: Create → Start → HTTP Health →
Publish fixed v1/v2 → Rollback once → Restart → Stop.

The work builds on the existing real `pockethost-demo` (loopback 18787)
and its ownership marker, existing serialized loopback DEV API (8787),
and owner-approved manual trusted-LAN gateway (18878/18879).
It **does not** adopt existing services, execute arbitrary shell commands,
start PhotoMap TEST, install packages, expose WAN or configure autostart.
User-approved trusted-LAN access still has no password and uses HTTP.

## Source changes implemented

- `src/shared/owned-site.ts`: typed owned project, bounded deployment events.
- `src/modules/host/owned-site-host.ts`: verified PID/start ticks for
  only the exact owned process; real HTTP instance health; private
  release history; fixed document validation and metadata-failure restore.
- `src/modules/runtime/owned-site-runtime.ts`: explicit owned-only Restart,
  rejected if not running; existing Start/Stop/Publish/Rollback policies kept.
- `apps/admin/vite.config.ts`: fixed `/api/v1/owned-site/project`,
  `/health` GET and guarded `restart` POST, existing intent/Origin
  checks, no arbitrary IDs/paths/ports/commands.
- `apps/admin/src/app/owned-site/page.tsx`: project details, health,
  process state, version selection, operations, history and bounded logs;
  confirmations for Stop/Restart/Rollback.
- `apps/admin/src/app/managed-projects/page.tsx`: actual owned demo
  alongside unchanged read-only PhotoMap TEST.
- `apps/admin/src/app/deployments/page.tsx` and
  `runtime-logs/page.tsx`: dedicated live-backed views.
- `apps/admin/src/lib/owned-project-schema.ts`: strict typed API data.
- `apps/admin/src/components/app-sidebar.tsx` and
  `apps/admin/src/config/routes.tsx`: all existing template routes kept;
  active PocketHost navigation first, templates labeled as examples.
- Negative Node tests for history bounds, forged PID, healthy owned server,
  symlink release rejection and runtime restart; UI schema tests for
  foreign project rejection, invalid start ticks and unbounded metadata.

This is one built-in application with two prebuilt release documents.
Generic multi-project registration, user uploads and arbitrary application
execution are **outside H1**, not quietly represented as completed.

## Earlier source-stage evidence

- Beginning `main`: `faf044700912a5bdad0fd613f2fd6f2bbede41b6`.
- Initial preflight task
  `pockethost-hosting-mvp-preflight-20261107-0616-v1`:
  `failed/125`, `not_started=true`; insufficient task budget;
  **zero commands executed**.
- Corrected read-only task
  `pockethost-hosting-mvp-preflight-20261107-0622-v2`:
  terminal `done/0`, live `f0dd506c996f700d50421b0545816c641f348bc5`,
  independent QA checkout clean at starting `faf0447`.
  All six protected runit services reported `running`:
  `wreckscanner`, `cloudflared`, `sshd`, `mosquitto`,
  `ilestoi-healthwatch`, `termux-agent`.
  Loopback 8787 and 18787 and private-LAN 18878 and 18879 open;
  PhotoMap TEST 8010 closed; existing demo running version 2;
  existing Network Access enabled.
- Intermediate H1 QA submitted:
  `pockethost-h1-native-check-all-09474fb-20261107-v1`,
  targeting `09474fbda72899e6ca7f2b5192ca563e7783b556`.
  This is **not the final code SHA** because additional source changes
  followed publication. Its outcome must not be counted as final QA.

## Accepted H1 source and Samsung device evidence — 2026-11-07

- **Application source:** `1edbd1b68cb1d0f4c21796172d25c5d0da10ebab`.
- **G2:** Samsung Termux Local Agent task
  `pockethost-h1-final-native-check-all-1edbd1b-20261107-v1`:
  terminal `done/0`, exact-SHA `npm run check:all` **PASS**.
  115/115 Node tests, 23/23 UI interaction tests, admin lint, TypeScript
  and Vite build passed. Coverage: 82.10% lines, 82.78% branches,
  80.54% functions. Independent QA checkout remained clean.
- **G3 guarded release:** task
  `pockethost-h1-guarded-g3-lan-release-1edbd1b-20261107-v1`:
  terminal `done/0 PASS`. Verified original live checkout and
  PID/start ticks before switching only the PocketHost preview to
  the accepted application SHA; re-enabled the owner-approved trusted-LAN
  gateway. Real LAN API/UI routes and owned-demo lifecycle passed:
  v2 → publish v1 → HTTP v1 → one-use rollback v2 → HTTP v2 →
  denied second rollback → restart → stop → start; checked changed
  owned process identity and bounded logs. Six protected services
  reported running and unchanged; PhotoMap TEST port 8010 stayed closed.
- **Owner Mac Chrome evidence:** owner supplied six actual Chrome
  screenshots and reported that the experience appeared to work.
  Images show the `/owned-site` panel with running/healthy v2,
  owned PID/start ticks, deployment history, bounded runtime logs,
  the stopped state with Start offered, and hosted HTML pages for
  `Updated local site` (v2) and `First local site` (v1).
  A later screenshot shows the browser-originated v2 → v1 publish
  entry in the history. The screenshots support core visual/browser
  operation; they do not individually prove every keyboard/failure
  state, browser rollback click or all other pages.

**H1 core single-demo MVP accepted and deployed.** The live
application remains `1edbd1b`; later documentation-only commits
must pass their own documentation checks and are not a new
application deployment.

## Follow-up, not a blocker for the accepted H1 demo

- The top-right header still says `Template landing` while
  displaying Project details; polish this UX in a separately tested
  code change.
- Complete exhaustive keyboard/ARIA and failure-state browser testing
  before treating the broader UI accessibility gate as fully closed.
- Preserve the no-login trusted-private-LAN limitation: HTTP admin
  is not appropriate for untrusted networks or public exposure.
- Generic multi-project hosting, user-provided deployments, packages,
  authenticated AI API and production PhotoMap remain future scope.

## Deferred modules

Package CMS, Termux package upgrades, generic app installers, multiple
user accounts, authenticated public AI API, DNS/HTTPS, PhotoMap
production runtime, arbitrary code execution, and autostart are not
part of this sprint.

See [handoff](../HANDOFF_NEXT_CHAT.md),
[quality gates](../QUALITY_GATES.md), and
[development plan](../DEVELOPMENT_PLAN.md).
