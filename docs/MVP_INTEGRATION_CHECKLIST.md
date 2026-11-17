# PocketHost — MVP integration acceptance checklist

Status: **PENDING INTEGRATION**. This file is a handoff, not an acceptance receipt.

## Before A8 acceptance

- [ ] Review and merge the four separate PRs into `main` (no cross-branch merge during parallel development): `mvp-20261117-sites`, `mvp-20261117-projects`, `mvp-20261117-deployments-logs`, `mvp-20261117-hosting-gate`.
- [ ] Resolve only concrete API/UI contract mismatches; retain the existing `/api/v1/sites` and `/api/v1/node-projects` read contracts and ownership/auth gates.
- [ ] Deploy the **combined exact main SHA** to verified Samsung A8 via guarded Local Agent flow, after checking ownership, protected services and rollback eligibility. Do not modify production or unrelated services.
- [ ] Obtain separate explicit authorization for each scoped test/QA run and each physical deployment/acceptance action as required by `AGENTS.md`.

## Owner acceptance on the combined A8 build

- [ ] **Static:** Create → Publish → Update → Rollback; confirm served content and active release after each stage.
- [ ] **Node.js:** Create → Prepare → Deploy → Start → HTTP → Stop → Rollback; verify authorization and owned runtime identity.
- [ ] **Deployments:** Lists the actual releases of both owned static sites and Node projects.
- [ ] **Project Logs:** Displays output from the correct owned project, not another service.
- [ ] **Hosting:** Navigates to `/sites`, `/projects`, `/deployments` and `/runtime-logs`.
- [ ] **Refresh:** Reloading the panel reflects actual running, stopped, unknown and current release states; unavailable APIs do not appear empty.

**Acceptance gate:** keep **PENDING INTEGRATION / NOT ACCEPTED** until all four PRs are merged, the combined build is deployed to A8, and the owner has physically verified every line above. A source commit or HTTP 200 alone is not acceptance.
