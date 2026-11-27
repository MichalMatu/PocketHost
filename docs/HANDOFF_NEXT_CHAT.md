---
status: active
owner: core
last_reviewed: 2026-11-27
purpose: V1 source acceptance, deploy boundary and safe future resume
---

# PocketHost — v1 handoff

- **Source:** `MichalMatu/PocketHost` `main`; G2-qualified runtime source `d2bacd081ad0879d49a08e3c7fd97789185ad6e4`.
- **G0–G2:** terminal `QA_PASS` on the paired Samsung A8 for `pockethost-a8-g2-final-core-d2bacd0-20261123-v1` and `pockethost-a8-g2-final-allui-d2bacd0-20261123-v1`. Historical UI **486/486** (two TSX exclusions corrected in Sprint 4F). Node **469 PASS, 1 SKIP**, line coverage **76.11%**; structure, docs, boundaries, budgets, Markdown, Prettier, root/admin lint, root/admin types and Vite build passed. Android hardlink SKIP.
- **Last device-attested DEV checkout:** `795eedda8759b64813ec0f51024886628706b6cd` (UX-05 App shell deploy PASS; panel PID 18819, start ticks 39154247 at deployment; HTTP, publication and protected services unchanged). Latest read-only before/after at 2026-11-27 10:31 UTC confirmed this SHA and panel reachability. Fresh host state must be verified on resume. Real LAN visual acceptance remains pending.
- **Browser UX:** owner reported acceptance of the current MVP (not an additional automated test receipt).

## Previously verified physical recovery and owned workflows

- Encrypted Node Restic backup/restore: `pockethost-a8-restic-node-backup-isolated-restore-20261117-v1` contains a nested **PASS** for one local snapshot and independent staging restoration of 10 owned files. Its outer postflight held on an overly strict unrelated Static inventory comparison.
- Independent read-only postflight `pockethost-a8-restic-postflight-owned-inventory-20261117-v1` was terminal **PASS** and confirmed 10 matching restored files, healthy Node and Static releases and untouched protected services.
- S1–S4 fixed owned worker lifecycle (create, start, health/logs, stop, archive, restore, retire) passed under `pockethost-a8-s1-s4-complete-owned-flow-396058d2-20261116-v1`.
- Scoped physical acceptance only; no loss-of-device or off-device credential recovery proof.

## Resume discipline

v1.0.0 is a frozen source tag, not a fresh deployment. Post-v1 development resumed 24 November. Do not resume the old night feature queue or repeat passed G2 solely because older documents show its earlier failures. The immutable N12 task `pockethost-a8-night-n12-dde5a04-qa-20261122-v1` is still UNKNOWN; do not replay it.

If later editing runtime code, first obtain fresh `main` and real A8 live SHA, run only approved non-destructive exact-SHA QA via the paired A8 Local Agent, and separately guarded-deploy/read back the new revision. Docs-only edits: Git commit only, no A8 build, test, service restart or deployment. Never use GitHub Actions, Codex or Work.

[Sprint 4](ROADMAP.md) closed: server adapters, runtime helper split, strict types, syntax-aware browser boundary and backup-session invalidation. Sprint 3 evidence: snapshot median 560.61 to 119.90 ms (-78.6%), 15/15 HTTP 200; static RSS and built UI experiments do not establish equivalent independent lifecycle or API/render behavior. See architecture. Public exposure, physical reboot, extended device endurance and off-device recovery remain separately scoped. Sprint 5 traffic analytics is deployed; existing Static and Node applications were not restarted, and their live snapshots are missing until their normal next start. Collection was proven in isolated real HTTP fixtures. Sprint 6 read-only SQLite Studio is deployed and qualified on isolated fixtures; no real application database was used for acceptance. WAL SHM coordination may change. Sprint 7 Application Starters is deployed. Deferred S8–S12: [upstream reuse](UPSTREAM_REUSE_STRATEGY.md) and [roadmap](ROADMAP.md).

## Current owner assignment — UX-05 (HOLD)

Standing owner consent covers routine non-destructive UX QA, read-only Mac captures and guarded DEV releases. See [UX plan](UX_EXECUTION_PLAN.md) and [guarded iteration](DEV_ITERATION.md). UX-01/02 deployed; UX-03 shared controls and UX-04 Hosting/Deployments refinements deployed with scoped synthetic visual reviews. Real LAN acceptance remains pending. Preserve the existing public session and protected services.

- **Runtime candidate:** `7ad8374e27857122cdf3a3e8f4484c17c179e37d` on main before this docs-only checkpoint. Relative to live `795eedda8759b64813ec0f51024886628706b6cd`, only `apps/admin/src/components/ui/command.tsx` and `apps/admin/tests/command-ui.interaction.test.tsx` changed. Shared Dialog/InputGroup defaults supply radius, height and addon padding; the test queries the rendered dialog portal. A CommandItem important override remains, and broader CSS cleanup is not complete.
- **Completed UX-05:** inventory/refinement at `2807965`; global CSS scoped QA/build and deploy PASS at `b2d735e`; App shell scoped QA/build and deploy PASS at `795eedd`. Both deployment receipts retain visual acceptance PENDING_BEFORE_AFTER. Inventory is heuristic, not proof of zero custom CSS.
- **Candidate QA:** [non-UI receipt](https://github.com/MichalMatu/local-agent/blob/agent-control/.agent/hosts/android-termux-a8/supervisor/fa8acc66-2f97-4600-845f-b35b0ada3a78/task-results/pockethost-a8-ux05-command-candidate-nonui-7ad8374-20261127-v1.json) terminal done/exit 0, format, admin lint/types, Node, budgets and admin build PASS. [Fixture repair receipt](https://github.com/MichalMatu/local-agent/blob/agent-control/.agent/hosts/android-termux-a8/supervisor/fa8acc66-2f97-4600-845f-b35b0ada3a78/task-results/pockethost-a8-ux05-command-fixture-fix-qa-7ad8374-20261127-v1.json) terminal done/exit 0, targeted UI PASS only.
- **Blocked aggregate UI:** [batch receipt](https://github.com/MichalMatu/local-agent/blob/agent-control/.agent/hosts/android-termux-a8/supervisor/fa8acc66-2f97-4600-845f-b35b0ada3a78/task-results/pockethost-a8-ux05-command-ui-batched-7ad8374-20261127-v1.json) terminal failed/exit 2 at 10:31 UTC; all seven batches (28 mapped files) rejected `--minWorkers` on Vitest 4.1.12. No functional aggregate result; no timeout or remaining process groups. QA and live checkouts were clean, source pinned, publication unchanged, no candidate deploy or restart.
- **Transport:** paired A8 `android-termux-a8`, installation `fa8acc66-2f97-4600-845f-b35b0ada3a78`, `MichalMatu/local-agent:agent-control`. At checkpoint, exact installation task and result Git trees each contained 1067 entries with matching names (no task lacking a result). This is not a current heartbeat or proof all historical results succeeded.

### Resume UX-05

1. Read fresh main and exact current A8 state/queue. This checkpoint is docs-only: the runtime candidate is `7ad8374`; distinguish it from the new documentation HEAD. Verify runtime equivalence and pin the exact current source SHA; never replay the old failed task or unknown historical N12.
2. On A8 only, inspect Vitest CLI help, remove unsupported `--minWorkers`, retain one worker, no file parallelism, bounded batches and cleanup guards. Reconcile the 28-file mapped set and use the existing exact-SHA approved UI gate; preserve previous receipts and use a new immutable task ID. Require all mapped files to run and pass, not just successful process exit. If a guard fails, stop and record HOLD.
3. Only after complete required QA, separately guarded-deploy and verify exact live SHA, owner/PID/ticks/HTTP/publication/protected services. Complete remaining scoped CSS inventory and required matching read-only before/after visual checks; never infer visual acceptance from QA or geometry. Do not open UX-06 until UX-05 acceptance gates are resolved.

No new A8 task or deploy is part of this documentation checkpoint. All remaining feature sprints follow UX-07.

## Previous CF1 closeout

**CF1 implementation CLOSED — do not replay.** See [Cloudflare roadmap](CLOUDFLARE_ROADMAP.md). Final UX QA and no-restart HMR deployment are terminal PASS at `af0b35a`. Owner confirmed that the manually published public HTTPS site works; the active publication state and exact URL were unchanged by QA and HMR. Queue empty at closeout verification. No automatic publication/unpublish, independent external probe, real connector shutdown test, physical reboot or endurance certification is claimed. Leave the existing session intact. Any future external acceptance work needs separate scope and approval. CF2–CF5 and S8–S12 remain deferred until UX-07 closure; preserve their approval gates. Re-read fresh main, live checkout SHA, startup marker and queue before later device work. This documentation-only closeout does not change deployed runtime, run tests or restart the panel.
