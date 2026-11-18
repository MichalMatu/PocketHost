---
status: active
owner: core
last_reviewed: 2026-11-18
purpose: Current Samsung A8 execution handoff, receipts and acceptance boundaries
---

# PocketHost — Galaxy A8 handoff

## Verified state

- Repo `MichalMatu/PocketHost`, source `main`: always read fresh HEAD.
- Last verified A8 DEV panel: `f2290b1ad7eebd91661f416f6189104c90df6504`; guarded FAST FLOW PASS, PID 335/start ticks 44118576, HTTP 200, protected services unchanged (`pockethost-a8-projects-final-compact-f2290b1-20261118-v1`). Four requested UX changes: consolidated runtime status and readiness; full source/import editor closed by default; compact release cards with detail disclosures; reduced owner-access copy. API, authorization and Node execution policy unchanged. Owner accepted `/projects` MVP layout on screenshots 2026-11-18. One-shot A8 QA `pockethost-a8-projects-final-ui-qa-f2290b1-20261118-v1` at this live code SHA: budgets PASS, boundaries PASS, admin-types PASS, UI FAIL on stale `Runtime: ...` expectations. Test-only fix `a8d825aa15ce3eceadffbbe44b2530bf6158a4e5` committed, **QA NOT RERUN**. Next page `/deployments`; no Node operation, backup/restore, reboot or scheduler.
- Previous `d8fbfa4a0ced11d8c6b9b38eab94d84c46fe2bbf` guarded release PASS; older scoped QA at `0cc7aba1f84bc1881eb53ac3aa216412c4a723ff` PASS does not certify the latest source.
- Only paired Galaxy A8 official Termux Local Agent, private `MichalMatu/local-agent` branch `agent-control`, immutable task/result path. No Mac, S22, Actions, Work, Codex, scheduler or automatic retries.
- Historical 7/7 QA at `c0bf02184c804d93fca7a50cddbdd9b1146ee2c8` does not cover newer SHA.
- Owner-accepted Static Create/Publish/Start and later physical v2 → HTTP → rollback to original v1 PASS. Authenticated trusted Node Create → Stage → Deploy → Health/Logs → Update → Stop/Start → Rollback PASS. Scoped Node Restic backup and staging-only restore PASS: one encrypted local snapshot, 10 verified files and no overwrite of live services. These do not accept ZIP/folder, off-device copy, browser visual UI, untrusted Node execution, reboot or public access. Preserve existing site/data.

## Owner-requested full QA baseline (2026-11-17)

Pinned source `96bf1a1100ba9d555d5f6bde467353bad2a59990` on Samsung A8. Structure PASS, module boundaries PASS. Documentation gate FAIL from old oversized `HANDOFF_NEXT_CHAT.md` / `START_HERE.md`. Node tests/coverage FAIL from stale `photomap-runtime-host.ts` fixture. Format, lint, types, build and UI checks could not start because pinned QA packages are missing from the isolated checkout; these are unavailable checks, not proved code defects. No production operation. Preserve exact receipt `pockethost-a8-full-qa-baseline-96bf1a1-20261117-v2`.

## Scoped A8 QA and source remediation (2026-11-18)

One explicitly approved run at `1cfe385f8345ada857b72d739f34904f4112a71e`: Node backup host tests PASS (fake Restic; **not** a second physical backup), module boundaries PASS, admin TypeScript PASS; UI FAIL on a stale Restic-status assertion and code budgets FAIL for three previously oversized legacy files. Receipt: `pockethost-a8-scoped-node-backup-qa-1cfe385f-20261118-v1`. On `main` commit `7246a05c...` the assertion and source modularity were corrected and the DEV panel deployed without running QA. These source fixes do **not** turn old failures into new test PASS. Fresh, exact-SHA owner consent is needed for another test run; browser visual acceptance is still open.

One new owner-approved QA run at exact `7246a05c5739f843f6f81344c6ec2a2931d82aac` (`pockethost-a8-approved-node-backup-qa-7246a05c-20261118-v1`): code budgets PASS, module boundaries PASS, fake-Restic Node backup host PASS, admin TypeScript PASS, UI 61/62 PASS. One failed UI test (`static-html-starter.interaction.test.tsx`) lacked the layout-provider mock, not a verified production UI defect. Source `eb82bb7...` extracted the typed Node client from `/projects`; source `48a9c90...` fixes this test harness, checks release inventories fail-closed, and records new Node candidate tests. This code was guarded-deployed but its own QA remains **NOT RUN**. One exact-SHA one-shot QA was subsequently approved and returned **PASS** (`pockethost-a8-scoped-projects-html-qa-48a9c901-20261118-v1`): code budgets, boundaries, fake-Restic Node backup host, admin TypeScript and affected UI suites. The prior HTML test-harness failure is no longer present in the targeted UI result. The current DEV live panel remained on `48a9c9015dcd025896f9bcf92c1a9acc92a814de`, with verified ownership unchanged; this was QA only, not a second deployment. No physical backup/restore, reboot or scheduler. Full repository QA and browser visual acceptance remain open.

## Browser screenshots and UI follow-up (2026-11-18)

Owner supplied screenshots from trusted LAN showing `/sites`, `/projects` (locked owner and selected Node demo), `/deployments`, `/runtime-logs`, and `/hosting`. Both Node and Static appear running, with project histories and the static log page rendering; this is **partial visual evidence only**, not proof of successful clicks, readiness or owner actions. The screenshots predate the layout cleanup deployed at `bc61493f2cc00c43243234246016c6de1ee5494d`. Check the updated `/projects` section order and `/deployments` collapsed history in browser. No ownership token was entered on screenshots; private-LAN HTTP is unencrypted. Any new QA run needs per-SHA explicit approval.

## PocketHost UX sprint (2026-11-18)

User requested every proposed fix after screenshots: prioritize `Owned projects`, collapse creation and Restic backup sections, compact owner token controls. Commit `634de0d36781662e4a59be7cf788df8eccadd2a1` changes presentation and an existing test fixture, not host API or authorization logic; size budgets remain pinned. The A8 QA task `pockethost-a8-owned-first-disclosures-qa-634de0d3-20261118-v1` finished PASS (budgets/boundaries/fake Restic/admin TS/UI), separately from the guarded DEV deployment `pockethost-a8-owned-first-disclosures-634de0d3-20261118-v1` PASS. No unauthorized Node action, physical backup/restore, reboot or scheduler. New browser layout remains to be inspected by owner.

## Source/editor and Node operations UX (2026-11-18)

Owner supplied follow-up screenshots, then requested four refinements: reduce the number of visible runtime controls, collapse the three source editors while distinguishing sample code from verified source, shorten IDs/dates and fold operation history, and avoid calling a prior staged source an automatically executable rollback. Commits `24498f4...` and `eb0464c...` implement these, with `09e4a09...` moving a previously unmapped test helper into tracked UI tests so strict QA planning does not need an exception. The first exact-SHA QA attempt on `eb0464c...` returned scope HOLD because of that unmapped helper; **it was not a product-code test failure**. A fresh exact-SHA QA for `09e4a096727df9fb013a2063b8382f1e87f16056`, `pockethost-a8-nodeux-qa-09e4a096-20261118-v1`, completed **PASS** for code budgets, module boundaries, fake-Restic backup host, admin TypeScript, and affected UI. A8 guarded DEV release `pockethost-a8-nodeux-runtime-source-09e4a096-20261118-v1` completed **PASS**, PID 20265, HTTP 200, protected services unchanged. No physical backup/restore, reboot, scheduler, or automatic node lifecycle operation. Browser visual sign-off remains open.

## Final Projects UX and Hosting readiness (2026-11-18)

Commits `f12351c...` and `f1a870e...` completed concise source safety text, disabled publishing affordance and explicit GET-only Node readiness in Hosting overview. Two earlier QA iterations revealed incomplete runtime mocks and link semantics; `36f7e68...` and `1d5f706...` repaired them without weakening gates. Exact-SHA QA `pockethost-a8-hosting-readiness-qa-1d5f7063-20261118-v1` PASS and guarded A8 release `pockethost-a8-hosting-readiness-1d5f7063-20261118-v1` PASS. No automatic health polling, restart, real backup/restore, reboot or scheduler. Updated overview visual acceptance is still open.

## Hosting exact-health identity release (2026-11-18)

Source `27a735d730e216226f249a4c9b90f2a297ef30a8` changes `apps/admin/src/app/hosting/page.tsx`: an explicit manual GET health reply must match the selected project's exact active release and state, or the UI reports `unavailable`, never a stale `not ready`. Three regression cases were added to `node-hosting-pages.interaction.test.tsx`, **NOT RUN**. One immutable A8 task `pockethost-a8-hosting-health-identity-27a735d-20261118-v1` returned terminal `done`, command exit 0 and nested FAST FLOW PASS; live SHA `27a735d730e216226f249a4c9b90f2a297ef30a8`, owner PID 21337, ticks 42712223, HTTP 200, protected services unchanged. No backup/restore, reboot, scheduler, or testing. Documentation-only follow-up does not require redeployment. Next: visual browser acceptance and separately authorized scoped QA if requested.

## Node backup catalog fail-closed release (2026-11-18)

Source `0cc7aba1f84bc1881eb53ac3aa216412c4a723ff` changes `apps/admin/src/app/projects/node-backup-panel.tsx`: catalog loss invalidates owner-session-bound backup response state, clears any prior operation approval/snapshot selection and prevents mutation controls from acting on stale Restic readiness. A focused regression case was added to `node-projects-disclosures.test.tsx`, and it passed in the later one-shot scoped QA `pockethost-a8-approved-hosting-backup-ui-qa-0cc7aba-20261118-v1`. Immutable A8 task `pockethost-a8-node-backup-catalog-guard-0cc7aba-20261118-v1` returned `done`, command exit 0, nested FAST FLOW PASS, live SHA `0cc7aba1f84bc1881eb53ac3aa216412c4a723ff`, owner PID 1109/ticks 42748698, HTTP 200, protected unchanged. No real backup/restore or scheduler/reboot. Browser acceptance and new exact-SHA QA still open. Documentation-only changes must not redeploy.

## One-shot owner-approved Hosting and Node backup QA (2026-11-18)

Task `pockethost-a8-approved-hosting-backup-ui-qa-0cc7aba-20261118-v1` on verified Galaxy A8 completed terminal `done`, command exit `0`, nested `PocketHostApprovedHostingBackupUiQA` PASS. Exact source `0cc7aba1f84bc1881eb53ac3aa216412c4a723ff`, prechange base `1d5f706314640438457d4acbc70dd5abed4ede01`. Checks: code budgets PASS (0.68 s), module boundaries PASS (0.59 s), `verify-changed.mjs` approved `admin-types,ui` PASS (admin TypeScript ~69.7 s, affected UI ~123.5 s). Source plan returned zero manual-review blockers. A8 QA preflight and owner readback PASS, live SHA unchanged. No deployment, backup, restore, reboot or scheduler. This is **targeted QA only**, not full G2 repository certification or browser visual acceptance.

## Screenshot-led Projects visual UX (2026-11-18)

Three owner screenshots from private LAN `/projects` showed an owned Node demo, running release `r-bc53...`, a different staged candidate `r-4953...`, locked owner controls and unprobed HTTP readiness. These screenshots are partial visual evidence, not an operator/health acceptance test. Source `d8fbfa4a0ced11d8c6b9b38eab94d84c46fe2bbf` improved active/staged separation, owner-access explanation, unselected project guidance and file picker presentation. A8 task `pockethost-a8-projects-ux-release-d8fbfa4a-20261118-v1` returned terminal done, command exit 0, nested guarded FAST FLOW PASS, live `d8fbfa4a0ced11d8c6b9b38eab94d84c46fe2bbf`, PID 24804/ticks 43612692, HTTP 200, protected services unchanged. Scoped UI regression written but not executed (test-only asynchronous assertion corrected after release), so **QA NOT RUN** on this source. Test/documentation-only follow-up does not redeploy. Browser visual sign-off still needed for the updated screen; no backup/restore, reboot or scheduler.

## Projects UX cleanup and guarded A8 release (2026-11-18)

Source `805f32a49308d7084be472f6371cc7a59d056234` reorganizes `/projects`: selected project is above Create and encrypted backup controls; active and prepared releases are distinct; technical Node/npm/port/health policy and setup details live under a closed disclosure. Controls, owner-token checks and negative cases are preserved. Affected UI test fixtures were updated but **NOT RUN**. Task `pockethost-a8-projects-clean-ux-805f32a4-20261118-v1` completed terminal done, command exit 0, nested guarded FAST FLOW PASS; live SHA `805f32a49308d7084be472f6371cc7a59d056234`, PID 30552/start ticks 43825005, HTTP 200, protected services unchanged. No real Node action, backup/restore, reboot or scheduler. Await browser visual acceptance and independently authorized exact-SHA QA if requested.

## Direction and safety

1. Restore QA prerequisites using only pinned root/admin lockfiles in isolated A8 QA checkout; never global npm installation or production dependency replacement.
2. Enforce code file-size budgets and browser/server boundaries. Refactor oversized `vite.config.ts` and `termux-service-admin.ts` incrementally; existing oversized files must not grow.
3. Node.js Hosting source/build/run uses the **same Termux OS user**, without a secure sandbox. A local owner-token gate already protects Node mutations and negative unauthenticated POST returned 403; never bypass it or expose the plaintext credential on an untrusted LAN. Arbitrary/untrusted execution remains prohibited; browser backup mutations stay disabled pending separate DEV enablement.
4. Show `/projects` as read-only over LAN; allow deployment and log inspection without misleading disabled-backend create/deploy buttons.
5. Keep [ROADMAP](ROADMAP.md), [MVP tracker](MVP_EXECUTION_PLAN.md) and [integration receipts](MVP_INTEGRATION_CHECKLIST.md) aligned. Framework/CMS examples do not imply active features; the current next steps are backup UI gating, browser visual sign-off and off-device copy design.

## Operational workflow

One guarded GitHub source commit → one A8 Local Agent `fast-flow.mjs --base=<verified-live> --target=<code-SHA> --apply` task → exact terminal receipt and independent owner/PID/HTTP/protected-service readback. A queue commit is not a deployment. QA is separately approved per exact scope and SHA. No reboot, SSH/WAN, unowned service or unexpected retry.

The [2026-11-17 checkpoint](checkpoints/2026-11-17-a8-static-mvp-local-agent-handoff.md), [checkpoint archive](checkpoints/README.md), and Git history `c09b4dc:docs/HANDOFF_NEXT_CHAT.md` retain previous detailed evidence.
