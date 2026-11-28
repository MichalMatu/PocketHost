---
status: active
owner: core
last_reviewed: 2026-11-28
purpose: V1 source acceptance, deploy boundary and safe future resume
---

# PocketHost — v1 handoff

- **Source:** `MichalMatu/PocketHost` `main`; G2-qualified runtime source `d2bacd081ad0879d49a08e3c7fd97789185ad6e4`.
- **G0–G2:** terminal `QA_PASS` on the paired Samsung A8 for `pockethost-a8-g2-final-core-d2bacd0-20261123-v1` and `pockethost-a8-g2-final-allui-d2bacd0-20261123-v1`. Historical UI **486/486** (two TSX exclusions corrected in Sprint 4F). Node **469 PASS, 1 SKIP**, line coverage **76.11%**; structure, docs, boundaries, budgets, Markdown, Prettier, root/admin lint, root/admin types and Vite build passed. Android hardlink SKIP.
- **Last device-attested DEV checkout:** `47fe02817e679472024b9ec59560b440e62512a7` (UX-06 Runit presentation deploy PASS, HTTP and protected services verified). QA tooling source `fc5301ec6a83b646e578005455de19a3fe528c00` PASS; subsequent documentation does not change runtime. Re-verify fresh main and live source before future work. Visual acceptance remains open.
- **Browser UX:** historical MVP acceptance does not apply to current visual coherence. Owner explicitly reported inconsistent cards, controls and positioning on 28 November. Current visual acceptance is OPEN.

## Previously verified physical recovery and owned workflows

- Encrypted Node Restic backup/restore: `pockethost-a8-restic-node-backup-isolated-restore-20261117-v1` contains a nested **PASS** for one local snapshot and independent staging restoration of 10 owned files. Its outer postflight held on an overly strict unrelated Static inventory comparison.
- Independent read-only postflight `pockethost-a8-restic-postflight-owned-inventory-20261117-v1` was terminal **PASS** and confirmed 10 matching restored files, healthy Node and Static releases and untouched protected services.
- S1–S4 fixed owned worker lifecycle (create, start, health/logs, stop, archive, restore, retire) passed under `pockethost-a8-s1-s4-complete-owned-flow-396058d2-20261116-v1`.
- Scoped physical acceptance only; no loss-of-device or off-device credential recovery proof.

## Resume discipline

v1.0.0 is a frozen source tag, not a fresh deployment. Post-v1 development resumed 24 November. Do not resume the old night feature queue or repeat passed G2 solely because older documents show its earlier failures. The immutable N12 task `pockethost-a8-night-n12-dde5a04-qa-20261122-v1` is still UNKNOWN; do not replay it.

If later editing runtime code, first obtain fresh `main` and real A8 live SHA, run only approved non-destructive exact-SHA QA via the paired A8 Local Agent, and separately guarded-deploy/read back the new revision. Docs-only edits: Git commit only, no A8 build, test, service restart or deployment. Never use GitHub Actions, Codex or Work.

[Sprint 4](ROADMAP.md) closed: server adapters, runtime helper split, strict types, syntax-aware browser boundary and backup-session invalidation. Sprint 3 evidence: snapshot median 560.61 to 119.90 ms (-78.6%), 15/15 HTTP 200; static RSS and built UI experiments do not establish equivalent independent lifecycle or API/render behavior. See architecture. Public exposure, physical reboot, extended device endurance and off-device recovery remain separately scoped. Sprint 5 traffic analytics is deployed; existing Static and Node applications were not restarted, and their live snapshots are missing until their normal next start. Collection was proven in isolated real HTTP fixtures. Sprint 6 read-only SQLite Studio is deployed and qualified on isolated fixtures; no real application database was used for acceptance. WAL SHM coordination may change. Sprint 7 Application Starters is deployed. Deferred S8–S12: [upstream reuse](UPSTREAM_REUSE_STRATEGY.md) and [roadmap](ROADMAP.md).

## 28 November — scoped technical closeout

Owner directed closure of UX-06 and the current work package, with no new sprint or visual audit until a separately agreed scope. **Technical closeout only; overall visual acceptance is not achieved.** Owner reported inconsistent cards, button positions and page compositions despite use of the shared template. This is an unresolved product defect, not a passed visual criterion.

- Last attested live runtime: `47fe02817e679472024b9ec59560b440e62512a7`, clean source and verified ownership, PID 16607/start ticks 48821333 at guarded deployment. Final quality-tooling QA source: `fc5301ec6a83b646e578005455de19a3fe528c00`. The runtime-to-tooling diff contains only two quality scripts and their test file; no runtime deployment or restart for those changes or this documentation closeout.
- A8 final tooling task `pockethost-a8-ux06-presentation-budget-qa-fc5301e-20261128-v1`: terminal PASS (receipt blob `e7c2c623345abd4eafc63f6ab81485afa1829cc0`), all seven exact-source checks, standalone code budgets, clean source and unchanged publication. Earlier two formatter-only failures remain historical; exact formatter diagnostic applied. No full aggregate regression was run at the final SHA.
- A8 final Runit release `pockethost-a8-ux06-runit-presentation-deploy-47fe028-20261128-v1`: PASS; project/static inventories, publication, access policy/token and protected services unchanged. Paired Mac LAN `pockethost-mac-ux06-runit-presentation-after-47fe028-20261128-v1`: HTTP 200, 12/12 rendered views, zero JS/request errors, overflow, tab overlap, tiny or unlabeled controls; 23 local screenshots, manual visual inspection pending. Do not equate these results with interaction or aesthetic acceptance.
- Incident: manual fast-flow initiated from the panel's own web terminal disconnected during restart and left the panel down on `d2f0983`. A8 read-only ownership checks and `pockethost-a8-recover-owned-panel-d2f0983-20261128-v1` restored the same clean source; read-only Mac LAN baseline passed. Subsequent independent guarded A8 release succeeded. Never initiate panel restart/deploy from its own web terminal.
- Closeout control snapshot `f99ee84012c7580ff714d6e3c5852ed19efa6121`: Local Agent idle; A8 task/result filenames matched 1125/1125. No current PocketHost task remains without a result on A8 or Mac. Historical unrelated Mac task anomalies and prior unknown N12 are not certified or replayed.
- No new UX-07, audit, feature, or hardware task is authorized by this closeout. Fresh owner agreement on visual-audit scope is required before resuming. Existing screenshots remain local; do not transfer or re-run them solely for paperwork.

### Resume only on new owner scope

Read [UX execution plan](UX_EXECUTION_PLAN.md) for the complete technical evidence and deferred items. The UX-03 component-composition inventory was already executed read-only before the owner's stop instruction; do not expand or implement that audit without the newly agreed scope. UX-01/02 real detail-state interaction/visual acceptance, UX-03 shared component consistency, UX-04 remaining review, UX-07 aggregate regression and actual owner visual approval are open. Preserve standing QA rules, protected services and private evidence. No new feature sprints or deployments merely to align a tooling/docs SHA with the running panel.

## Previous CF1 closeout

**CF1 implementation CLOSED — do not replay.** See [Cloudflare roadmap](CLOUDFLARE_ROADMAP.md). Final UX QA and no-restart HMR deployment are terminal PASS at `af0b35a`. Owner confirmed that the manually published public HTTPS site works; the active publication state and exact URL were unchanged by QA and HMR. Queue empty at closeout verification. No automatic publication/unpublish, independent external probe, real connector shutdown test, physical reboot or endurance certification is claimed. Leave the existing session intact. Any future external acceptance work needs separate scope and approval. CF2–CF5 and S8–S12 remain deferred until UX-07 closure; preserve their approval gates. Re-read fresh main, live checkout SHA, startup marker and queue before later device work. This documentation-only closeout does not change deployed runtime, run tests or restart the panel.
