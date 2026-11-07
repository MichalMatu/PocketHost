---
status: implementation-pending-native-acceptance
owner: core
last_reviewed: 2026-11-07
purpose: Distinguish PocketHost H1 source implementation from Samsung and LAN release evidence
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

## Physical evidence known at source checkpoint

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

The **new code has not yet passed final exact-SHA Samsung G2**
or a new G3 live-browser and controlled-release gate at this checkpoint.
The previously accepted historical P3/O1 runtime and LAN tests do not
transfer to H1. Do not claim live cutover before terminal task result.

## H1 release gate and pending work

1. Resolve the intermediate QA task and any specific lint/type/test failures.
2. Run `npm run check:all` on Samsung via Local Agent on final `main`
   SHA; record the exact terminal task ID, exit code and UI test count.
3. Prove own project HTTP response, real two-version publish, one-step
   rollback, restart/stop/start, bounded logs and no port conflict,
   all without touching six foreign services or PhotoMap TEST.
4. If native G2 passes, verify current live preview owner PID/start ticks
   and record, guarded switch of PocketHost-only Vite preview, restore
   manual trusted-LAN gateway and test LAN API/UI. Roll back to exact
   old source on failure. If process identity or rollback uncertain,
   **hold deployment** and leave unrelated services untouched.
5. Record Mac Chrome visual/keyboard success separately; HTTP 200 on
   Samsung is not proof of a real human browser interaction.

## Deferred modules

Package CMS, Termux package upgrades, generic app installers, multiple
user accounts, authenticated public AI API, DNS/HTTPS, PhotoMap
production runtime, arbitrary code execution, and autostart are not
part of this sprint.

See [handoff](../HANDOFF_NEXT_CHAT.md),
[quality gates](../QUALITY_GATES.md), and
[development plan](../DEVELOPMENT_PLAN.md).
