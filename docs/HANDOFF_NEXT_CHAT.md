---
status: active
owner: core
last_reviewed: 2026-11-18
purpose: Current Samsung A8 execution handoff, receipts and acceptance boundaries
---

# PocketHost — Galaxy A8 handoff

## Verified state

- Repo `MichalMatu/PocketHost`, source `main`: always read fresh HEAD.
- Last verified DEV panel A8: `48a9c9015dcd025896f9bcf92c1a9acc92a814de`; guarded FAST FLOW PASS, PID 9858/start ticks 37356176, HTTP 200, protected services unchanged. Exact receipt `pockethost-a8-projects-client-validation-48a9c901-20261118-v1`. No tests run during this deployment. Earlier real Node/Static/Restic P0/P1 are historical scoped evidence; browser visual acceptance and off-device recovery remain open.
- Only paired Galaxy A8 official Termux Local Agent, private `MichalMatu/local-agent` branch `agent-control`, immutable task/result path. No Mac, S22, Actions, Work, Codex, scheduler or automatic retries.
- Historical 7/7 QA at `c0bf02184c804d93fca7a50cddbdd9b1146ee2c8` does not cover newer SHA.
- Owner-accepted Static Create/Publish/Start and later physical v2 → HTTP → rollback to original v1 PASS. Authenticated trusted Node Create → Stage → Deploy → Health/Logs → Update → Stop/Start → Rollback PASS. Scoped Node Restic backup and staging-only restore PASS: one encrypted local snapshot, 10 verified files and no overwrite of live services. These do not accept ZIP/folder, off-device copy, browser visual UI, untrusted Node execution, reboot or public access. Preserve existing site/data.

## Owner-requested full QA baseline (2026-11-17)

Pinned source `96bf1a1100ba9d555d5f6bde467353bad2a59990` on Samsung A8. Structure PASS, module boundaries PASS. Documentation gate FAIL from old oversized `HANDOFF_NEXT_CHAT.md` / `START_HERE.md`. Node tests/coverage FAIL from stale `photomap-runtime-host.ts` fixture. Format, lint, types, build and UI checks could not start because pinned QA packages are missing from the isolated checkout; these are unavailable checks, not proved code defects. No production operation. Preserve exact receipt `pockethost-a8-full-qa-baseline-96bf1a1-20261117-v2`.

## Scoped A8 QA and source remediation (2026-11-18)

One explicitly approved run at `1cfe385f8345ada857b72d739f34904f4112a71e`: Node backup host tests PASS (fake Restic; **not** a second physical backup), module boundaries PASS, admin TypeScript PASS; UI FAIL on a stale Restic-status assertion and code budgets FAIL for three previously oversized legacy files. Receipt: `pockethost-a8-scoped-node-backup-qa-1cfe385f-20261118-v1`. On `main` commit `7246a05c...` the assertion and source modularity were corrected and the DEV panel deployed without running QA. These source fixes do **not** turn old failures into new test PASS. Fresh, exact-SHA owner consent is needed for another test run; browser visual acceptance is still open.

One new owner-approved QA run at exact `7246a05c5739f843f6f81344c6ec2a2931d82aac` (`pockethost-a8-approved-node-backup-qa-7246a05c-20261118-v1`): code budgets PASS, module boundaries PASS, fake-Restic Node backup host PASS, admin TypeScript PASS, UI 61/62 PASS. One failed UI test (`static-html-starter.interaction.test.tsx`) lacked the layout-provider mock, not a verified production UI defect. Source `eb82bb7...` extracted the typed Node client from `/projects`; source `48a9c90...` fixes this test harness, checks release inventories fail-closed, and records new Node candidate tests. This code was guarded-deployed but its own QA remains **NOT RUN**. A fresh owner approval tied to `48a9c9015dcd025896f9bcf92c1a9acc92a814de` is required before executing another test suite.

## Direction and safety

1. Restore QA prerequisites using only pinned root/admin lockfiles in isolated A8 QA checkout; never global npm installation or production dependency replacement.
2. Enforce code file-size budgets and browser/server boundaries. Refactor oversized `vite.config.ts` and `termux-service-admin.ts` incrementally; existing oversized files must not grow.
3. Node.js Hosting source/build/run uses the **same Termux OS user**, without a secure sandbox. A local owner-token gate already protects Node mutations and negative unauthenticated POST returned 403; never bypass it or expose the plaintext credential on an untrusted LAN. Arbitrary/untrusted execution remains prohibited; browser backup mutations stay disabled pending separate DEV enablement.
4. Show `/projects` as read-only over LAN; allow deployment and log inspection without misleading disabled-backend create/deploy buttons.
5. Keep [ROADMAP](ROADMAP.md), [MVP tracker](MVP_EXECUTION_PLAN.md) and [integration receipts](MVP_INTEGRATION_CHECKLIST.md) aligned. Framework/CMS examples do not imply active features; the current next steps are backup UI gating, browser visual sign-off and off-device copy design.

## Operational workflow

One guarded GitHub source commit → one A8 Local Agent `fast-flow.mjs --base=<verified-live> --target=<code-SHA> --apply` task → exact terminal receipt and independent owner/PID/HTTP/protected-service readback. A queue commit is not a deployment. QA is separately approved per exact scope and SHA. No reboot, SSH/WAN, unowned service or unexpected retry.

The [2026-11-17 checkpoint](checkpoints/2026-11-17-a8-static-mvp-local-agent-handoff.md), [checkpoint archive](checkpoints/README.md), and Git history `c09b4dc:docs/HANDOFF_NEXT_CHAT.md` retain previous detailed evidence.
