---
status: active
owner: core
last_reviewed: 2026-11-23
purpose: Current A8 ownership, exact-source QA evidence and safe next steps
---

# PocketHost — current handoff

First read [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md), [MVP plan](MVP_EXECUTION_PLAN.md), [A8 transport](LOCAL_AGENT_TERMUX.md), [DEV iteration](DEV_ITERATION.md) and [night sprint](NIGHT_AUTONOMOUS_SPRINT.md). Use GitHub Connector and immutable tasks at `MichalMatu/local-agent:agent-control`. Only paired Samsung A8 may run QA/build/deploy. No GitHub Actions, Codex, Work, Mac/sandbox project QA or automatic task replay. Standing user consent covers necessary nondestructive A8 QA and guarded private DEV, in separate exact-SHA tasks.

## Verified state — 23 November 2026

- **Source before this handoff rewrite:** `main@193775a7f0ab78116ff28356e9a2aa02e2323ec1`. New `apps/admin/tests/root-layout.interaction.test.tsx` covers route layout, fallback and failure UI. Earlier Node Stage/Restore readback source through `e75c498145f2783db123a60e77aa18fc164371b1` has NOT passed current QA.
- **Actual A8 live DEV:** `c4dedfd23b597a95a96f00379786fe36f6cf27e2`, NOT the stale `d0468ab` checkpoint. Independent read-only receipt `pockethost-a8-live-preflight-readback-20261123-v2`: owned DEV SHA, panel owner and gateway matched; PID **7907**, start ticks **5399**, HTTP **200**, protected `sshd`/`ssh-agent` down, Agent runit active, DEV and QA checkouts clean with correct origins. Always verify afresh before a future deployment.
- **N12:** `pockethost-a8-night-n12-dde5a04-qa-20261122-v1` remains immutable **UNKNOWN**: `interrupted_or_uncertain_execution_no_replay`. Do NOT retry it. Read-only `pockethost-a8-n12-owner-claim-diagnostic-20261123-v1` verified N12 claim/spool digest, free N12 execution and PocketHost resource locks, zero observed Node QA processes and proper A8 identity. One unmatched historical local claim remains; this does NOT certify global maintenance or restart safety.
- **Accepted cumulative QA plan:** `pockethost-a8-plan-root-layout-193775a-20261123-v1` returned PLAN, no manual review, **66 changed files**, baseline actual live `c4dedfd`, target `193775a`. Categories: syntax, format, structure, docs, root lint, Markdown, admin TypeScript, Node and UI.

## Terminal cumulative QA: FAIL

Task `pockethost-a8-cumulative-193775a-qa-20261123-v1` on exact source `193775a7f0ab78116ff28356e9a2aa02e2323ec1`: **21 syntax checks PASS**, structure PASS, root lint PASS, Markdown lint PASS. **Format FAIL** (at least `scripts/dev/changed-checks-policy.mjs`, `scripts/dev/verify-changed-policy.mjs`, `scripts/dev/verify-changed.mjs`, `scripts/test-lab/artifact-names.mjs`, `scripts/test-lab/capture-warnings.mjs`, `scripts/test-lab/capture.mjs`; receipt may truncate paths). **Docs FAIL**: previous 111 KB handoff exceeded **6144-byte** active-context budget. TypeScript, Node and UI all **SKIPPED**, never mark PASS. No build or deployment occurred.

## Next actions

1. Keep this active handoff below 6144 UTF-8 bytes. All its earlier detailed entries remain available in the [immutable pre-compaction Git version](https://github.com/MichalMatu/PocketHost/blob/193775a7f0ab78116ff28356e9a2aa02e2323ec1/docs/HANDOFF_NEXT_CHAT.md), plus the [checkpoint index](checkpoints/README.md).
2. On verified A8, obtain full Prettier mismatched-file list using read-only diagnostics. Fix affected source formatting in GitHub; preserve QA checkout cleanliness and do not disable checks.
3. Re-plan against **actual** live SHA and fresh `main`; run one bounded separate A8 `verify-changed.mjs --base=<actual-live-sha> --execute --approved-head=<exact-main-sha> --approved-checks=<planned-categories>` task. Examine every result. Correct functional regressions if needed. No other executor or stale PASS.
4. Only after terminal exact-SHA QA PASS, consider a **separate** guarded DEV flow `ops/termux/fast-flow.mjs --base=<fresh-owned-live-sha> --target=<tested-sha> --apply`. Recheck clean source, owner/PID/start ticks, protected services, HTTP and rollback before changes.

## Still open

Real browser ZIP/folder/HTML import, served bytes, independently created Node project acceptance, mutable-data recovery, broad G2/browser visual QA, physical reboot and public cutover. Historic mocks and unrelated test results do not satisfy these.
