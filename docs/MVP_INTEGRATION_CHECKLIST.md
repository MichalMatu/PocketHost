# PocketHost Hosting MVP — integration and owner acceptance

Status: **HOSTING P0 DEVICE FLOWS PASS (NODE + STATIC); API/ROUTES PASS; BROWSER OWNER SIGN-OFF AND P1 RECOVERY/REBOOT PENDING**.

## Device-backed Hosting P0 (2026-11-17, later acceptance run)

- **Node.js: PASS** on verified Samsung A8, live panel code `0db0327239194e4a8d9da538308529681ad666fc`. Local Agent receipt `pockethost-a8-mvp-real-owned-node-continue-0db03272-20261117-v3`: existing private, owner-authorized demo project `node-0ccd04db610a46418fc113753019b8fb` staged v1 `r-bc53b74d151a4cd1b9508f56d54bac05`, deployed and verified loopback HTTP 200/readiness/logs at port 19300, updated to v2 `r-4953df3424a342128e341c7c3b4545f8`, stopped, started and rolled back to v1. All stages PASS. The demo remains running on v1. The owner secret was read only on A8 and never logged or copied to GitHub.
- **Static: PASS** on existing site `site-33cca1ef73fd4bd89b41d979b754ccfe`. Receipt `pockethost-a8-mvp-static-v2-rollback-0db03272-20261117-v1`: initial one-file v1 `r-22ad782ce6ef40489494a293ed87669b`, published v2 `r-db3cf2c7aaa64a4d93b3f5cd826c3303`, verified exact served HTML at HTTP 200, rolled back and reverified original source and served bytes (SHA-256 `92cf4486770d065263c944d49d563145f07e3c725f19d4f97e8c815da8b3f7a6`). Node demo, panel and protected services unaffected.
- **Hosting APIs/routes: PASS**. Receipt `pockethost-a8-mvp-live-hosting-navigation-0db03272-20261117-v1`: five SPA routes, four direct-link routes, static and Node catalogs, project-scoped log APIs all HTTP 200. Node logs have 5 lines. This verifies HTTP availability and live API state, **not** final browser-rendered interaction or human visual sign-off.
- These are narrowly scoped owner-requested *physical A8 operations*, not repository-wide automated QA, not separate external device/browser approval and not evidence for backup/restore or reboot/autostart. Existing user data preserved; one new demo Node project was intentionally retained.

## Delivered 2026-11-17

- Four parallel MVP scopes (`/sites`, `/projects`, `/deployments` + `/runtime-logs`, `/hosting`) collected in [merged integration PR #6](https://github.com/MichalMatu/PocketHost/pull/6). Exact integration merge: `74e8da8685544a542c69e6cc209d95c24b5537f9`. Source paths from #2–#5 were disjoint.
- Owner-gated Node activation committed as `0db0327239194e4a8d9da538308529681ad666fc`. Its A8 runit launcher enables Node APIs/runtime/dependency/build features only with a local, owner-owned regular `0600` token file `~/.local/state/pockethost/node-owner-token`; invalid or missing credential fails closed while Static remains enabled. The token was provisioned and fixed locally on A8; its value was never sent to GitHub or logged.
- Verified Samsung A8 guarded DEV deployment of the integration: Local Agent receipt `pockethost-a8-mvp-integrated-main-74e8da86-guarded-dev-release-20261117-v1` **PASS**, exact SHA, PID/start ticks, HTTP 200, protected services unchanged.
- Node activation: the initial release `pockethost-a8-mvp-node-secure-activation-main-0db03272-20261117-v1` correctly reported **HOLD** on the first Node readback due to a malformed generated token file; its guarded deployment itself succeeded. One bounded atomic token-file repair and guarded owner-panel restart (`pockethost-a8-mvp-node-owner-token-local-repair-0db03272-20261117-v1`) ended **PASS**. Verified **live code SHA `0db0327239194e4a8d9da538308529681ad666fc`**, owned panel PID **30805**, start ticks **36348379**, Node API HTTP 200, Static API HTTP 200, protected services unchanged.
- Browser routes `/sites`, `/projects`, `/deployments`, `/runtime-logs`, `/hosting` returned HTML + HTTP 200 when requested as browser HTML. Node owner session is configured but unauthenticated without the token. Targeted negative POST to create a Node project without a token returned **403**; Node inventory stayed **0**, Static inventory remained **1** (running). Receipt `pockethost-a8-mvp-node-unauthorized-write-denial-0db03272-20261117-v1` **PASS**.
- No WAN, SSH, Android reboot, scheduler, foreign services, or arbitrary user Node application execution was performed. Static site/user data preserved.

## Selective QA receipts (no test-all)

- Static Sprint #4 at `85715d40a23f13962cc2ff8a380b7ea8d2ea9efb`: **15/15 UI PASS** (site inventory and HTML editor), **2/2 backend PASS** including isolated v1/v2 HTTP serving and rollback. Separate readback receipts `pockethost-a8-sites-final-ui-qa-85715d40-20261117-v1` and `pockethost-a8-sites-isolated-http-qa-85715d40-20261117-v1`.
- Node Sprint #5 at `ff801977f64117f0bf83c3b665b531e996c82567`: **37/37 project UI PASS**, targeted LAN deadline test PASS. Receipt `pockethost-a8-pr5-targeted-ui-with-isolated-deps-ff801977-20261117-v1`.
- Integrated PR #6 at `649dd31a85e44a120eecf8c83207d6b29ec43633`: **3/3 targeted Node backend PASS**, **59/63 UI PASS** with four test harness/assertion failures. Fixed the missing mock for Hosting's layout and whitespace-sensitive deployment history assertion. On the subsequent source SHA `5e3af1ebb5c06cac3f8d35a0a3825a5665f3c2ae`, the **11/11 affected Hosting/Deployments UI assertions PASS**; receipt `pockethost-a8-mvp-pr6-focus-hosting-deployments-5e3af1eb-20261117-valid-v3`.
- These are **exact-SHA, selective tests only**. No repository-wide test, lint, formatting, or types gate was run; do not misattribute one commit's QA result to later commits.

## Remaining owner acceptance and P1

- [ ] **Browser UI:** on trusted LAN, visually check `/hosting`, `/sites?site=<id>`, `/projects?project=<id>`, `/deployments`, `/runtime-logs?project=static:<id>` and `node:<id>`; click links, refresh and verify both owners' entries. An HTML 200 alone does not prove React-rendered UI.
- [x] **A8 Local Agent P0:** real Node Create → Stage → Deploy → HTTP/Health/Logs → Update → Stop/Start → Rollback; real Static Update → served HTML → Rollback. Both PASS at exact live SHA above.
- [ ] **P1 scoped backup/restore:** perform an authorized real backup, restore into isolated staging and verify restoration without overwriting live user data; capture evidence before marking accepted.
- [ ] **P1 Termux:Boot/autostart:** separately authorize an actual Android reboot, then read back PocketHost-owned panel/Node and protected services. No reboot, scheduler or Boot mutation was conducted as part of P0.
- [ ] **Final owner sign-off** once the browser interaction and P1 checks are complete. Do not mark overall Hosting accepted solely from API/HTTP receipts.

**Next:** browser visual acceptance, then separately approved backup/restore and reboot. Cloudflare, domains and Python/PHP are deferred in [TermuxPanel reuse backlog](TERMUXPANEL_REUSE_BACKLOG.md).
