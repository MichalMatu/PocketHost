---
status: source-updated-native-validation-open
owner: core
last_reviewed: 2026-11-09
purpose: Record M0 UI repair, M1 registry hardening, immutable Samsung task requests and next-chat acceptance gates
---

# PocketHost — M0/M1 autonomous continuation checkpoint

## Source and scope

- Repository: `MichalMatu/PocketHost`, **main only**. Verified source parent: `5502819bbe75b097914afef8226cddf5eacb4cf4`; code HEAD after this sprint: `10731bca1f46bc16d21f902176f01fcfa871e5ba`. This documentation-only checkpoint will advance `main` again; always fetch the fresh HEAD.
- Native executor: existing Samsung Termux Local Agent, through the separate private `MichalMatu/local-agent` `agent-control` transport. No PocketHost project binding or new service.
- **Source changes are committed; neither new Samsung task had a terminal result when this checkpoint was prepared. No migration, host deployment, panel restart, site or protected service mutation occurred.**

## Durable inherited evidence (do not replay)

- At `c97132c6`, 196/196 Node, 18/18 focused host/PhotoMap and 18/18 scoped UI tests passed. Subsequent source changes do not inherit exact-SHA acceptance.
- At `5bccbe2`, Samsung M0 remaining-gate task `pockethost-m0-remaining-gates-s22-5bccbe2-20261109-v1` ended **failed/1**. Markdownlint, ESLint, TypeScript, coverage, admin lint and Vite build passed; Prettier failed on nine files and full UI had four failures. Original output confirms a stale GiB/MiB dashboard assertion and undefined legacy `SiteServiceActions` test import; the full details of the other failures are not published in its bounded tail.
- Still **without a terminal result observed** in the private transport at this checkpoint:
  - `pockethost-m0-remaining-gates-s22-5bccbe2b-20261109-v1`
  - `pockethost-m1-registry-store-focused-s22-01db6f2-20261109-v1`
  - `pockethost-m1-registry-boundary-focused-s22-2b5d300f-20261109-v1`
- These three tasks are immutable requests, **not PASS**. Read their exact receipts before reissuing any overlapping work.

## M0 code/test repair in this sprint

Commit `4754b535d90a90810f3f78adc9962ab34637554a`:

1. `system-dashboard.interaction.test.tsx` now matches the already-accepted shared binary formatter: `2.3 GiB` and `117.3 GiB`, not obsolete raw MiB display.
2. Removed the stale test import and invocation of `SiteServiceActions` from `termux-admin.interaction.test.tsx`. The old component no longer exists; reintroducing it would duplicate Hosting ownership logic.
3. Added an explicit owned-site Start/intent/PID-state UI test to `site-fleet.interaction.test.tsx`, where the real Hosting lifecycle controls live.

These are source changes only. **Unknown additional UI failures remain OPEN until focused native evidence is read.**

## M1 hardening in this sprint

Commit `10731bca1f46bc16d21f902176f01fcfa871e5ba`:

1. The sole `src/modules/host/hosting-registry-store.ts` keeps its private, exact-root and revisioned JSON contract. It now requires a same-UID, private root and stored file; it reads with `O_NOFOLLOW` and rechecks the opened inode.
2. New writes synchronize the temporary file before atomic rename and synchronize the parent directory after rename. Invalid or overflowing expected revisions are rejected.
3. Disposable negative fixtures cover nonprivate roots/files, unversioned legacy data, unsupported future envelopes and unsafe revision overflow.
4. **No schema migration was authorized or executed.** The store still accepts the explicit v1 envelope only and refuses implicit adoption, unknown versions and foreign data. A genuine versioned migration planner, reversible migration format and live host-owner attestation are **OPEN**. File UID/mode checks do not prove service/process ownership.

No second registry store was introduced. All new tests must run on Samsung before being called PASS.

## Newly published Samsung requests — results not yet confirmed

Both requests address the verified exact Samsung installation and a clean isolated QA checkout; both use the `repository:pockethost` resource lease. They do not change the live panel or any managed/foreign site.

| Task ID | Exact source | Scope | Status at checkpoint |
| --- | --- | --- | --- |
| `pockethost-m0-m1-focused-native-10731bca-20261109-v1` | `10731bca` | M1 schema/store negatives, module boundaries, affected three UI test files, root ESLint, TypeScript and changed-file Prettier check | PUBLISHED; terminal receipt UNKNOWN |
| `pockethost-m0-format-diff-native-10731bca-20261109-v1` | `10731bca` | Read-only Prettier scan and unified diffs for formatting failures, with no checkout writes | PUBLISHED; terminal receipt UNKNOWN |

Task publication is not execution evidence. Do not restart queued tasks or infer PASS from absence of errors. Native task content and results remain in the private Local Agent repository, not in PocketHost.

## Quality and release gate ledger

| Gate | State | Reason / needed evidence |
| --- | --- | --- |
| G0 foundation | OPEN on latest source | Prior structural and 196-node results accepted at earlier SHAs; new M1 tests and boundaries not yet terminal. |
| G1 formatting/lint/type | OPEN | Known nine-file Prettier failure at `5bccbe2`; newer source needs targeted native results and canonical format repair. |
| G2 full UI/source | OPEN | Full UI reported four failures at `5bccbe2`. Two causes repaired in source, the remaining failures and exact-final-SHA matrix not proven. |
| M1 persistence | OPEN | Source changes made; exact-source native tests, positive owner contract, migration/recovery design still required. |
| G3 physical / release | OPEN | No exact-current-SHA install, disposable owned-site lifecycle/rollback, reboot/watchdog or protected-service before/after acceptance. |

Earlier PocketHost-only runit/private-LAN 200 and six protected services intact are **historical evidence**, not a new live check or permission to change services. No new physical health claims were made in this sprint.

## Next autonomous continuation

1. Fetch fresh PocketHost `main` and private Local Agent `agent-control`; check concurrent commits. Read all **five** outstanding task receipts (three inherited plus two newly published). Note exact result SHA, status and command exit codes; never replay passed suites.
2. Apply only genuine Prettier diffs from the read-only Samsung task to current source via GitHub Connector, with expected-HEAD writes. Do not run formatting or PocketHost tests in Linux/Mac.
3. Investigate actual remaining UI failures via the new focused receipt, not by guessing. Repair the current Hosting UI test path rather than reinstating removed legacy controls.
4. Validate the new M1 private-file and fsync behavior on Samsung; if negative fixtures fail, fix only those causes. Plan migration compatibility and rollback **in source on disposable fixtures**, with no operation against an existing registry or external service.
5. Run only missing affected final-source G0/G1/G2 gates. Exact-current-source formal closeout and physical validation are distinct. If native receipts are absent or device state is unknown, keep the corresponding gate **OPEN**.
6. Preserve active websites, external Termux runit services, Local Agent, Cloudflare, DNS, SSH and existing PocketHost panel process. No GitHub Actions, Codex, Work, force-push or new development branch.

**Closeout:** this is a complete source-and-handoff checkpoint, **not** an M0/M1 milestone PASS.
