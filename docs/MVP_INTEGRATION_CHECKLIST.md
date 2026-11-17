# PocketHost Hosting MVP — integration and owner acceptance

Status: **IMPLEMENTED AND DEPLOYED TO VERIFIED A8 DEV — READY FOR OWNER ACCEPTANCE; NOT PHYSICALLY ACCEPTED END-TO-END**.

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

## Still requiring owner functional sign-off

- [ ] On a trusted private LAN browser, verify selecting each existing owned Static site and navigating through all five Hosting routes. The existing Static basic create/publish/start was separately accepted earlier; update/rollback isolated test receipts are not full manual browser acceptance.
- [ ] On the A8 **locally**, read the owner token from `~/.local/state/pockethost/node-owner-token` in trusted Termux and unlock `/projects`. **Never share the token in chat or Git.**
- [ ] Use one deliberately reviewed, trusted owner Node app for physical **Create → Stage → Prepare → Deploy → HTTP readiness → Logs → Update → Stop/Start → Rollback**, confirming source, release and process identity at each step. Node apps execute as the same Termux user and are **not sandboxed**. Current Node inventory is zero; no disposable Node project was created because the API has no verified retirement path and enforces a bounded project count.
- [ ] Compare live Static and Node state in `/deployments`, `/runtime-logs`, `/hosting` with the real owned workloads, verify refresh and safe failures, and explicitly mark **ACCEPTED** only after physical owner review.

**Gate:** Code integration, scoped QA and A8 deployment are complete; **the full Node app lifecycle has not been physically accepted**. Do not claim that HTTP 200, a merged PR, or unit tests alone close owner acceptance.
