---
status: active
owner: core
last_reviewed: 2026-11-23
purpose: Verified A8 DEV release, scoped QA receipts and next safe actions
---

# PocketHost — current handoff

Read [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [MVP plan](MVP_EXECUTION_PLAN.md), [A8 transport](LOCAL_AGENT_TERMUX.md), [DEV iteration](DEV_ITERATION.md) and [night sprint](NIGHT_AUTONOMOUS_SPRINT.md). Source is `MichalMatu/PocketHost:main`; exclusive paired A8 task transport is `MichalMatu/local-agent:agent-control`. No Codex, Work, GitHub Actions, foreign-host project QA, automatic replay, public changes or protected service mutations.

## Verified delivery — 23 November 2026

- **Deployed DEV code:** `349087d2981c7fc3d8b9feba12d8fc335956a08b`, from independently verified prior live `c4dedfd23b597a95a96f00379786fe36f6cf27e2`. The earlier `d0468ab` deployment checkpoint is historical, not today's live baseline.
- **Deployment:** immutable A8 result `pockethost-a8-dev-349087d-deploy-20261123-v1` terminal `done`, nested `PocketHostA8DevFastFlow.status=PASS`, `flow.status=PASS`, `deployment=applied`, verified live SHA, PID **6158**, start ticks **3518977**, HTTP 200, guarded service isolation unchanged, tests not run *inside* deployment. Independent SHA-pinned `format,ui` QA receipt was verified before release.
- **Post-release smoke:** `pockethost-a8-postdeploy-349087d-http-smoke-20261123-v1` terminal PASS. The six routes `/dashboard`, `/sites`, `/projects`, `/local-agent`, `/services`, `/settings/platform` each returned HTTP 200. PID/ticks and protected services matched. This proves HTTP reachability, NOT real browser screen acceptance or site data integrity.
- **Last complete focused regression:** `pockethost-a8-ui-regressions-349087d-20261123-v1`, target exact 40-hex `349087d`, base `e47dacea2abc2a85e0d3940569262e783bc2fcf1`, terminal `QA_PASS`: changed-file format PASS and 121/121 UI tests in four corrected files PASS. Test fixture corrections: `d98378a` (site release summary, Node Stage readback), `5e6a95a` (version reopen stale-error checks), `3f369dd` and `349087d` (raw Agent log stalled continuation fixture).
- **Prior cumulative QA:** `pockethost-a8-cumulative-e47dace-qa-20261123-v1` on `e47dace`: syntax 21/21, format, structure, docs, root lint, Markdown lint, admin TypeScript and Node tests PASS; broad UI reached 300s and nine tests failed. The nine were fixed and confirmed by the later **scoped 121/121 PASS**, but the original whole-suite G2 run was NOT PASS.
- **N12:** immutable `pockethost-a8-night-n12-dde5a04-qa-20261122-v1` remains UNKNOWN; never replay. Read-only `pockethost-a8-n12-owner-claim-diagnostic-20261123-v1` proved free N12 execution and PocketHost resource locks. The historical unmatched local claim still forbids claiming unrestricted host maintenance safety. Always fresh-verify owned A8 state before future tasks.

## Next safe work

1. **No redundant release for this docs-only update.** Fresh `main` may be newer than live `349087d` only because the handoff and quality status were synchronized after the verified release.
2. For subsequent code edits pin a new exact SHA, choose dependency-mapped targeted QA on A8, inspect terminal results, then separately guarded DEV deployment with fresh actual live base. The private Mac Test Lab exception permits only narrowly scoped read-only browser screenshots/geometry/GET, never off-device build/deploy.
3. Broader G2 qualification and real browser static ZIP/folder/HTML imports, served-byte comparison, independently created Node project acceptance, mutable-data recovery and G3 physical reboot remain OPEN. Do not use customer data or launch public network exposure under routine test consent.

Earlier detailed handoff history remains in the [pre-compaction Git revision](https://github.com/MichalMatu/PocketHost/blob/193775a7f0ab78116ff28356e9a2aa02e2323ec1/docs/HANDOFF_NEXT_CHAT.md) and [checkpoint archive](checkpoints/README.md). External Chat Bridge messages, not an internal scheduler, initiate later turns.
