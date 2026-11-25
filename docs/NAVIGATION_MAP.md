---
status: active
owner: product
last_reviewed: 2026-11-25
purpose: Current navigation, screen responsibility and contextual link audit
---

# Navigation and screen map

Source audit of [navigation.ts](../apps/admin/src/config/navigation.ts), [routes.tsx](../apps/admin/src/config/routes.tsx) and their page/component implementations at live `a0a68aa513f0e79043af75274785ec9cdb28a2a5`. This is a code-derived map of 28 sidebar destinations in seven groups, not a fresh browser or visual acceptance result. Conditional controls require the relevant verified data, state and permissions.

## Overview

| Menu entry | Route | Display and actions |
| --- | --- | --- |
| Dashboard | `/dashboard` | CPU, RAM, storage, services, battery, uptime, DNS, alerts, 1h/24h/7d charts, connectivity, transfer rates, bridge and events; refresh; link to Shizuku. |
| Monitoring | `/observability` | Process inventory, filter, sort CPU/RAM/PID, process details, telemetry sources, diagnostic events; refresh; project logs link. |
| Host inventory | `/host` | Node version, uptime, free memory, storage, observed runit services; read-only refresh. |

## Hosting

| Menu entry (current order) | Route | Display and actions |
| --- | --- | --- |
| Add website | `/sites/new` | Site name, empty site, ZIP/folder import, starter HTML or HTML+CSS; capacity and verified creation; return to catalog. |
| Hosting overview | `/hosting` | Static and Node inventories, runtime status, release and links to details and logs; Node readiness; links to deployments and both catalogs. |
| Static websites | `/sites` | Compact site list: name, port, file count, bytes, state; add, refresh and per-site detail links. |
| Node.js applications | `/projects` | Owner access, project picker, runtime, source and releases, dependencies/build, reviewed execution and publish, maintenance/rollback, logs, traffic, data/SQLite, backup and creation/import disclosure. |
| Deployments | `/deployments` | Static and Node active/previous releases and event histories; detail and log links; Node rollback review link. |
| Project logs | `/runtime-logs` | Select static/Node project, up to 50 log lines, search, refresh, links to project and Monitoring. |

### Selected website

`/sites/:id` (legacy `/sites?site=:id` remains supported). Header: name, process state, port, file/byte and release counts. Global controls: start/stop/restart, rollback, HTTP verification, hosted-site link when running, error/busy/unknown-outcome feedback.

| Tab | Display and actions |
| --- | --- |
| Overview | Active release, verified PID/start ticks, memory, uptime. |
| Files | Edit/publish HTML, ZIP/folder upload, download active ZIP, inspect assets. |
| Versions | Saved immutable releases, preview, restore/prune with protection; deployment history. |
| Traffic | On-demand 24h/7d traffic, RPS, payload, statuses, paths and charts. |
| Public access | Quick Tunnel state, publish/unpublish, assigned URL and copy controls. |
| Logs | On-demand owned runtime logs. |
| Settings | Site ID and guarded deletion of a stopped site. |

Creation navigates to the verified new site; deletion returns to the catalog. Existing detail links from Hosting, Deployments, Project logs, recovery coverage and public publication resolve to the site workspace. Tabs currently hold local UI state, not independently addressable URLs.

### Selected Node application

`/projects?project=:id` selects the application on the same page as the picker, owner access and creation. Anchor links target Runtime, Source and Releases. Source includes requirements, public GitHub/local file/folder import and editors; staged release, dependency/build review, run approval and publishing remain separate verified steps. Data/SQLite and Restic backup/staging restore are additional disclosures. UX-02 should use distinct list/create/detail routes, preserve old links and reuse this workflow rather than add new hosting features.

## Services

| Menu entry | Route | Display and actions |
| --- | --- | --- |
| Overview | `/services` | Grid of links derived from Services navigation; no independent inventory. |
| Runit services | `/services/runit` | Desired vs observed, owned workers, start/stop/restart, source review, log inspection, archive/restore, protected view-only services; link to Node projects. |
| Autostart | `/services/autostart` | Boot observation, A8 service chain and Runit autostart registry/policy. |
| Hosting workloads | `/services/hosting` | Owned Node and Static runtime inventories, readiness and links to the catalogs. |
| Health checks | `/services/health` | Core service checks, Hosting workloads and Runit/worker health, reviewed recovery, heartbeat policy and manual HTTP readiness. |
| Cloudflare Tunnel | `/services/cloudflare` | Public session, connector/config/log diagnostics, setup readiness and package link. |
| SSH | `/services/ssh` | Dedicated A8 SSH/terminal controls, interactive connection profiles and protected other SSH diagnostics; link to Terminal. |
| Mosquitto MQTT | `/services/mqtt` | Protected broker observation and refresh. |

Generic `/services/:serviceId` uses the same diagnostic registry. All three named diagnostic routes and independent service access must be retained.

## Local Agent

| Menu entry | Route | Display and actions |
| --- | --- | --- |
| Local Agent | `/local-agent` | Overview (service/intake/results/transport), Tasks & activity (counts, latency, completions), Live console (raw logs), Control (owned agent operations), Diagnostics (advanced control plane); links to SSH and private Git transport. |

## System & Tools

| Menu entry | Route | Display and actions |
| --- | --- | --- |
| Android & Shizuku | `/shizuku` | Android apps/packages, permissions, processes, services, privileged shell and diagnostics; search, sort, inspect and authorized controls. |
| Phone Settings | `/phone-settings` | Display brightness/mode and screen timeout through authorized companion. |
| Packages & Software | `/packages` | Software inventory and package manager: ecosystems, installed/available, search, metadata refresh, preview/apply operations. |
| File Manager | `/files` | Termux home/shared filesystem, quick locations, browse, import, file actions and text editor. |
| Terminal | `/terminal` | Owned interactive Termux terminal start/stop and embedded shell; package prerequisite link. |
| Backups & Recovery | `/backups` | Recovery coverage linked to owned sites/projects; workspace snapshots, encrypted workspace archive, full Termux Restic archive and staging restore. |

The last four views share the TermuxCenterPage section shell; these are separate routes, not four duplicate implementations.

## Automation and Settings

| Menu entry | Route | Display and actions |
| --- | --- | --- |
| Agents & API | `/agents` | Local Agent / AI control API information and copyable example. |
| Platform | `/settings/platform` | LAN, SSH, Termux:Boot, Git checkout/origin; links to Network access, SSH and Autostart. |
| Network access | `/settings/network` | Gateway observation, interfaces/bind selection, enable/disable Home LAN and observed admin/demo URLs. |
| Appearance | `/settings/appearance` | Color theme selection. Header also exposes theme customization. |

Global shell: sidebar/logo to Dashboard, command search derived from navigation, sidebar toggle and appearance controls. Sidebar active state currently uses exact path matching; selected-site detail needs parent highlighting without marking Add website active.

Other registered paths: `/`, `/termux`, `/system` redirect to Dashboard; `/owned-site` is the separately enabled owned demo workspace (not a sidebar item); catch-all is not-found.

## Consolidation recommendations (not implemented)

- Keep the just-approved Add website first. In UX-02 add a separate Node creation entry and align both hosting lifecycles. Reassess Hosting order after that, without silently moving the new first item.
- Hosting overview should be a cross-project summary/entry hub, not another full runtime manager. Link each row directly to the relevant project workspace and section.
- Keep global Deployments and Project logs as cross-project indexes; move project-specific actions/data into one detail workspace, using common components and exact project/section deep links. Add direct back-links with preserved project selection.
- Dashboard = host health trends; Monitoring = process diagnostics; Host inventory = technical inventory. Remove repeated presentation, not the underlying observations. Consider making Host inventory a Dashboard secondary view after scope review.
- Services overview repeats sidebar destinations. Replace link-only grid with a useful service summary or compact landing; retain independent service URLs. Health checks and Hosting workloads share runtime observations; give one canonical runtime/health component clear responsibilities. Link to exact owned projects, not only the catalog.
- Cloudflare global connector diagnostics and per-site public session are different contexts backed by one publication state. Add mutual context links; do not duplicate connector controls. SSH and Local Agent remain independent protected surfaces; link terminal and relevant diagnostics rather than clone them.
- Consolidate Agents & API information into Local Agent documentation/section if confirmed redundant. Platform remains an overview linking to canonical settings. Android process diagnostics are device-wide, Monitoring is Termux-visible; label scope rather than conflate them.
- Use common page header, breadcrumb, status badges, lists, empty/error states and contextual actions in UX-03. Avoid creating a separate menu item for every tab. Preserve direct URLs/legacy links, owner checks, warning semantics and accessibility.

See [UX execution plan](UX_EXECUTION_PLAN.md) for implementation order. Visual review remains open; this map does not claim screenshots of the revised UI.
