---
status: active
owner: core
last_reviewed: 2026-11-25
purpose: Source-based upstream adoption audit and decisions
---

# Upstream reuse — selective, not a merge

Compared [TermuxPanel source](https://github.com/himalayladha/termux-hosting-panel/tree/0d6ce220885694e62707c9efd37a7af11afc3154) at `0d6ce220885694e62707c9efd37a7af11afc3154` with [PocketHost source](https://github.com/MichalMatu/PocketHost/tree/2dab459a9232acc78ffa12ff3d86cc440c0fd4d0) at `2dab459a9232acc78ffa12ff3d86cc440c0fd4d0`. Static source review only: no upstream execution, fresh A8 benchmark, dependency installation or new runtime qualification. The authoritative ordered checklist is [ROADMAP](ROADMAP.md).

## Audit of existing order

- S1 Static lifecycle before new hosting features: retain. Upstream `websites.routes.js` provides delete/start/stop; PocketHost `site-fleet-api.ts` and `site-fleet-host.ts` add owned release lifecycle, capacity and rollback. No repeat of closed S1.
- S2 cleanup before adding features: retain. Existing import/reference audit and pruned UI/dependencies are documented; source comparison is not a new dead-code certification.
- S3 performance before feature growth: retain. Upstream embeds static listeners in one process; PocketHost's measured shared-process memory benefit did not establish equivalent independent ownership/lifecycle. Keep S3 measurements and current per-site process model.
- S4 architecture/QA before S5 and later adapters: retain. Typed browser/API/host seams support bounded feature work; large host lifecycle files and built-UI/API equivalence remain known debt, not a reason to repeat the closed sprint.
- S5 analytics after these foundations: retain. Upstream `analytics.service.js` uses global RPS, per-request SQL writes and estimated active users. PocketHost `traffic-http.mjs`, `traffic-history.mjs` and `traffic-store.mjs` implement per-project completed-response aggregates and bounded coalesced storage. No upstream code imported. A8 QA/deploy PASS is recorded in [QUALITY_GATES](QUALITY_GATES.md); collection in existing live applications is not yet observed until their normal next start.

## Open-sprint source audit

| Sprint | Upstream source / actual feature | PocketHost source / actual gap | Decision |
| --- | --- | --- | --- |
| S6 SQLite | `database.service.js`, `databases.routes.js`, `frontend/js/databases.js`: list/schema/paged rows, sql.js whole-file load, create/delete and arbitrary SQL | S6 closed: `node-sqlite-studio.ts`, `node-sqlite-reader.mjs`, `node-sqlite-api.ts`, `node-sqlite-panel.tsx` | Independent native read-only adapter, scoped UX, bounded WAL-aware reads; A8 QA/benchmark/deploy PASS. No upstream runtime source copied. |
| S7 Starters | `templates/html`, `templates/node`, `templates/python`, `templates/php`: simple starter files | `site-client.ts`, `site-creation-form.tsx`, `node-project-client.ts`, `projects/page.tsx`: existing HTML/Node example and source import | Only nonduplicate templates; Node SQLite example after S6; Python/PHP after runtime qualification. |
| S8 HTTP | `process.service.js`: gzip on eligible assets; `analytics.service.js`: average response time | `site-fleet-server.mjs`: verified GET/HEAD but no gzip; `traffic-http.mjs` and `traffic-history.mjs`: no latency aggregates | Benchmark first, then bounded gzip and response duration, preserving cache/release and byte semantics. |
| S9 Files/packages | `file.service.js`, `files.routes.js`: ZIP and grouped operations; `packages.service.js`: direct npm/pip install/remove/update | `termux-file-roots.ts`, `full-files.tsx`, `site-fleet-api.ts`, `node-dependency-preparer.ts`: existing file actions/ZIP flows and attested npm candidate preparation | Add only gaps in UI/staging; never direct mutation of active releases. Upstream file path checks are lexical; retain our canonical path and ownership checks. |
| S10 Monitoring | `uptime.service.js`: timed probes, latency history, auto-restart; `notification.service.js`: Telegram/Discord | `worker-loopback-readiness.ts`, `health-checks-page.tsx`: owned on-demand probes; no equivalent per-project observed availability/notification workflow identified | Observation history first, no competing scheduler/auto-healer; external delivery separately approved. |
| S11 Auto deploy | `webhook.service.js`: signature support, shell-based package install and restart | `node-github-source.ts`, `node-project-api.ts`, `node-runit-host.ts`: commit-pinned source preview and staged releases, no equivalent webhook orchestration identified | Reuse event intent and history ideas, not in-place updates. Local event fixture and guarded rollback first; external ingress separately approved. |
| S12 Python/PHP | `process.service.js` and runtime templates: Python/PHP launchers | Static/Node hosting and runit ownership primitives, no qualified Python/PHP hosting adapters | Separate owner-approved capability, one runtime at a time after shared workflows. |

The ordering deliberately makes read-only data inspection precede templates using data; performance telemetry precede history/alerts; candidate file/dependency changes precede automated deployment; and additional runtimes follow the shared lifecycle contracts. Do not expand feature breadth at the expense of measured A8 budgets.

## Excluded or deferred

- Keep PocketHost runit supervision and independent Local Agent; upstream process manager, cron and watchdog can conflict with ownership and recovery.
- Keep Restic and existing staging restore. Upstream `backup.service.js` and `teledrive.service.js` offer archive/Telegram ideas but do not establish equivalent encrypted independent recovery; off-device data transfer is separate owner scope.
- Keep existing terminal, SSH, host package management and Android/Companion diagnostics. Hardware/watchdog code is not a reason to duplicate working controls.
- Domain, Cloudflare and email routing are not required for the accepted private-LAN product. Preserve current network boundary; public changes require approval.
- Full Express/backend migration, global SQLite panel state migration, live database mutation and unrestricted SQL are not adoption targets.

## License and evidence

Upstream [MIT license](https://github.com/himalayladha/termux-hosting-panel/blob/0d6ce220885694e62707c9efd37a7af11afc3154/LICENSE), copyright © 2026 Himalay Ladha, permits reuse subject to preserving the copyright and permission notice in copies or substantial portions. Record exact upstream file/SHA and notice if copying source. No runtime code was copied by this audit. Each future feature still needs its own implementation review and scoped A8 QA; this comparison is not proof of upstream correctness, feature completeness or measured performance.
