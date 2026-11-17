# PocketHost — MVP integration acceptance checklist

Status: **PENDING INTEGRATION**. This file is a handoff, not an acceptance receipt.

## Before A8 acceptance

- [ ] Review and merge the four separate PRs into `main` (no cross-branch merge during parallel development): `mvp-20261117-sites`, `mvp-20261117-projects`, `mvp-20261117-deployments-logs`, `mvp-20261117-hosting-gate`.
- [ ] Resolve only concrete API/UI contract mismatches; retain the existing `/api/v1/sites` and `/api/v1/node-projects` read contracts and ownership/auth gates.
- [ ] Deploy the **combined exact main SHA** to verified Samsung A8 via guarded Local Agent flow, after checking ownership, protected services and rollback eligibility. Do not modify production or unrelated services.
- [ ] Obtain separate explicit authorization for each scoped test/QA run and each physical deployment/acceptance action as required by `AGENTS.md`.


## Parallel PR integration review (source only, 2026-11-17)

All four PRs now exist: [Sites #4](https://github.com/MichalMatu/PocketHost/pull/4), [Projects #5](https://github.com/MichalMatu/PocketHost/pull/5), [Deployments/Logs #3](https://github.com/MichalMatu/PocketHost/pull/3), and [Hosting #2](https://github.com/MichalMatu/PocketHost/pull/2).

- GitHub compare against the common base shows **no edited-file overlap** between the four PRs. That is a source-change check, not a combined build result.
- Navigation contracts align: `/sites?site=<site-id>`, `/projects?project=<node-id>`, and `/runtime-logs?project=static:<site-id>|node:<node-id>`; the route paths are already registered.
- Data contracts align by existing readers: `parseFleetSites` for static inventory, `readNodeRuntimeCatalog` for Node state, and `readProjectLogCatalog` for the log selector.
- The Node PR enforces a separate `X-PocketHost-Node-Owner` authorization for mutating operations; the Hosting overview intentionally makes only read-only inventory requests and must not expose mutation shortcuts.
- **No confirmed integration mismatch requiring source changes so far.** Confirm in the combined merged build, rather than marking integration PASS from individual PR review.

## Exact-SHA targeted QA receipt (2026-11-17)

Owner authorized only narrow, changed-code QA. A8 Local Agent immutable task `pockethost-a8-mvp-pr6-targeted-node-ui-39194aed-20261117-v1` completed (exit 1, PARTIAL) on integrated source `39194aed29576759f218a292373a0b40b0984a74`:

- **PASS:** exactly 2 focused Node tests: static HTML edit/update/rollback and Node owner LAN timeouts.
- **FAIL:** Vitest invocation limited to five changed page test files (`hosting-selection`, `node-hosting-pages`, `node-projects`, `site-fleet`, `sites-html-editor`). Two confirmed stale test expectations were a combined PID/start ticks label and a URL assumed to contain a site ID rather than its loopback port. The bounded receipt does not retain every failing assertion; do not claim other failures are repaired.
- **No all-suite QA, lint, typecheck, format, production deployment, or external-service mutations.** Live panel remained `79be0852cb204b535bfc0ce8a42a78aaf92330ea` before/after.
- The integrated candidate was then advanced to include newer #4/#5 source revisions, and the two known test assertions were corrected. **These later source commits have not been retested.** PR5 separately reported 37/37 UI tests PASS at `ff801977f64117f0bf83c3b665b531e996c82567`, not at the combined SHA.
- Next gate: fresh, exact-SHA scoped owner permission for any further targeted run. Do not describe this candidate as QA PASS or deployed.

## Owner acceptance on the combined A8 build

- [ ] **Static:** Create → Publish → Update → Rollback; confirm served content and active release after each stage.
- [ ] **Node.js:** Create → Prepare → Deploy → Start → HTTP → Stop → Rollback; verify authorization and owned runtime identity.
- [ ] **Deployments:** Lists the actual releases of both owned static sites and Node projects.
- [ ] **Project Logs:** Displays output from the correct owned project, not another service.
- [ ] **Hosting:** Navigates to `/sites`, `/projects`, `/deployments` and `/runtime-logs`.
- [ ] **Refresh:** Reloading the panel reflects actual running, stopped, unknown and current release states; unavailable APIs do not appear empty.

**Acceptance gate:** keep **PENDING INTEGRATION / NOT ACCEPTED** until all four PRs are merged, the combined build is deployed to A8, and the owner has physically verified every line above. A source commit or HTTP 200 alone is not acceptance.
