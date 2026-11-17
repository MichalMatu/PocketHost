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

## Owner acceptance on the combined A8 build

- [ ] **Static:** Create → Publish → Update → Rollback; confirm served content and active release after each stage.
- [ ] **Node.js:** Create → Prepare → Deploy → Start → HTTP → Stop → Rollback; verify authorization and owned runtime identity.
- [ ] **Deployments:** Lists the actual releases of both owned static sites and Node projects.
- [ ] **Project Logs:** Displays output from the correct owned project, not another service.
- [ ] **Hosting:** Navigates to `/sites`, `/projects`, `/deployments` and `/runtime-logs`.
- [ ] **Refresh:** Reloading the panel reflects actual running, stopped, unknown and current release states; unavailable APIs do not appear empty.

**Acceptance gate:** keep **PENDING INTEGRATION / NOT ACCEPTED** until all four PRs are merged, the combined build is deployed to A8, and the owner has physically verified every line above. A source commit or HTTP 200 alone is not acceptance.
