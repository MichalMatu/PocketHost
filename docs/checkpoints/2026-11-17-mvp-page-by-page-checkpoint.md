---
status: checkpoint
owner: core
last_reviewed: 2026-11-17
purpose: MVP-first page-by-page completion plan, scope, evidence and delivery estimate
---

# PocketHost — MVP checkpoint: finish one page at a time

## Baseline and evidence

- Source code checkpoint: `04a5a07281cf4556091f6e0815989df15e338a57` on `main` (later documentation-only commit is not deployed).
- Last verified running Samsung A8 DEV source: `79be0852cb204b535bfc0ce8a42a78aaf92330ea` (owned panel, HTTP 200, no changes to protected services at its receipt). Source and live are **not** the same revision.
- Confirmed on real A8/LAN: PocketHost panel, host/system observations, static site **Create → Publish HTML → Start → private LAN render → manual Verify HTTP**. One fixed-template standalone worker previously completed Create → Start → Health/Logs → Stop → Archive/Restore/Retire on A8.
- Source cleanup: project-specific PhotoMap/IleStoi code/tests removed; latest named-path scan at `c3b741d` found zero references; affected Node tests, root/admin types and code budgets passed. At `c3b741d`, affected UI had 55/56 passing; the remaining outdated navigation test passed 3/3 at `04a5a07`. These are **targeted QA results on different SHAs**, not a full latest-SHA certification.
- Full latest-SHA QA, production deployment of newer code, Node.js end-to-end deployment, static second-release rollback, reboot and real backup restoration remain **unverified**.

## MVP scope and page decisions

Definitions: **PROVEN** = actual user/device observation; **CODE** = available UI/backend but incomplete user flow or no device acceptance; **DEFER** = does not block the first usable MVP.

| Order | Page / route                                                 | Current status                        | Acceptance required for MVP                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Static websites** `/sites`                                 | **PROVEN** for first HTML site only   | Complete edit → second release → publish → HTTP check → rollback to old content; verify stop/start; clear error states; no ZIP/folder requirement for minimum MVP                                                           |
| 2     | **Node.js applications** `/projects`                         | **CODE; blocked for LAN writes**      | One trusted owner-reviewed Node app: create → source → prepare → deploy/start → private HTTP/readiness → stop → rollback; explicit authenticated owner authorization; never rely on `X-PocketHost-Intent` as authentication |
| 3     | **Deployments** `/deployments`                               | **CODE**                              | Show exact current/previous release and state for both app types; navigate to owned release and rollback; no invented status                                                                                                |
| 4     | **Project logs** `/runtime-logs`                             | **CODE**                              | Read bounded current logs for an owned selected app; error/empty state; no leaked secrets or external process adoption                                                                                                      |
| 5     | **Hosting overview** `/hosting`                              | **CODE**                              | Clear entry points and honest active/disabled statuses to the four pages above                                                                                                                                              |
| 6     | **Dashboard / Monitoring / Host inventory**                  | **PROVEN in part**                    | Keep existing read-only live information, correct unavailable states; no redesign                                                                                                                                           |
| 7     | **Services** overview/Runit/Hosting/Health                   | **CODE + one real fixed-worker flow** | Preserve operation as is; only fix a defect blocking MVP, defer generic user-script execution                                                                                                                               |
| 8     | **Local Agent / protected service pages**                    | **PROVEN in part/read-only**          | Keep status and diagnostics; no changes to foreign services                                                                                                                                                                 |
| 9     | **Autostart, Network, Platform, Backups**                    | **CODE, physical acceptance OPEN**    | Nonblocking for private LAN MVP; label unverified, defer reboot, SSH, WAN and real restore                                                                                                                                  |
| 10    | **Shizuku, Phone settings, file/package/terminal, examples** | **MIXED / DEFER**                     | No expansion or styling sprint before Hosting core is complete                                                                                                                                                              |

**MVP cutline:** Private-LAN Hosting of a static HTML site **with update and rollback**, plus one **trusted, explicitly owner-authorized** Node.js backend, their release status and bounded logs. This is a device-local DEV MVP, **not** a public multi-tenant platform. If LAN owner authorization or same-UID Node execution cannot be made acceptable, ship only the working static MVP and explicitly hold Node; never silently disable a guard.

## Remaining work and rough effort

Estimates are **engineering effort ranges, not deadlines**, assuming reuse of existing implementation, no new hardware failures, and one acceptance scenario per page:

| Work package                                                                          | Budget      |
| ------------------------------------------------------------------------------------- | ----------- |
| Finish `/sites`: second publish, update, HTTP/content, rollback, stop/start           | 4–8 h       |
| Finish `/projects`: owner authorization + one trusted Node end-to-end deploy/rollback | 12–22 h     |
| Finish `/deployments` + `/runtime-logs`: connect to verified runtime                  | 4–8 h       |
| Finish `/hosting` + focused acceptance on A8 + defects                                | 6–10 h      |
| **Total private-LAN MVP estimate**                                                    | **26–48 h** |

Authentication, physical Android behavior or new Node/Termux runtime issues may increase the estimate. This does **not** include public TLS, multi-user security, secure isolation of untrusted Node code, full Backup/Restore, full device reboot acceptance, UI template cleanup or wide cross-page polish.

## Faster execution policy

1. **One page at a time** in the exact order above. Define one visible user path and one objective PASS/FAIL before writing code; finish it before changing another page.
2. **Reuse existing code**. No broad file/module refactor, doc archaeology, all-project audit, parallel feature branch, redesign or repeat full suite unless a specific defect requires it. The legacy file-size budgets stay in place; split only when a new change truly requires it.
3. **One meaningful source increment → one guarded A8 deployment → readback**, with no extra jobs, no speculative retries and no standing scheduler. Build effort around user-visible results, not diagnostic output.
4. **Targeted tests only upon fresh explicit user approval** for the relevant scope/SHA. Necessary operational deploy guards are mandatory; QA is not silently attached to FAST FLOW.
5. **Page acceptance:** exact source/live SHA, one actual working flow, saved state survives refresh, appropriate error/rollback response, no modifications to unowned services; owner confirms before `ACCEPTED`.
6. **Blocker rule:** report a real blocker once with the smallest concrete missing permission or source defect. No fake success, no widening into unrelated security or platform work.

## First next action

Start with `/sites`: make a second HTML release on the **existing owned static test site only with explicit user approval for the live mutation**, validate displayed content, then rollback and confirm the original content. After that, tackle `/projects` secure owner authorization and the one-app Node path. No physical reboot, WAN/SSH changes, independent Local Agent update or other-service operations.

Historical details remain in Git history; this checkpoint is the short current delivery contract.
