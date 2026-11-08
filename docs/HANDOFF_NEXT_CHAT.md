---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: H3.4 live G3 PASS with remaining physical Termux and browser acceptance
---

# PocketHost — DEV fast iteration; historical H3.4 release evidence

## New owner decision — Shizuku power-user evolution (2026-11-08)

PocketHost should become a **full-featured power-user control panel
for Android and Termux**, integrating the owner's installed Shizuku app.
No artificial application-level restrictions on advanced operations;
provide what actual Shizuku/Android privileges permit. Android ADB-mode
privileges are not root. Browser access alone does not grant Binder
permissions. Start at `/shizuku` with capability contracts and evolve
to a native Android bridge with real per-app authorization.
Do not fake successful permission grants or silently operate on unrelated
services. Real advanced actions must be clearly user-directed.
[ADR-0013](adr/0013-shizuku-power-user.md), [module](modules/shizuku.md).

Hardware evidence: Samsung SM-S906B on Android 16; Shizuku app installed;
Mac ADB `dumpsys cpuinfo` returned 31% TOTAL in a spot check. The
Shizuku *server* and native PocketHost app authorization are not yet
confirmed. No claim that the new UI has a working Shizuku connection.

## Current working agreement — 2026-11-08

PocketHost is a **DEV panel**. Owner-approved loop:
**edit -> main commit -> quick relevant test -> Vite HMR / restart only
the verified PocketHost-owned panel -> owner feedback -> repeat**.
Do not treat each cosmetic edit as a production G3 rollout, require
full `check:all`, invent a second preview installation or duplicate
the preflight already accepted for the same host. Use
[DEV iteration runbook](DEV_ITERATION.md) and
[ADR-0012](adr/0012-private-ui-rapid-review.md).
Test full product quality at milestone closeout; preserve foreign services,
site data and exact process ownership. Historical hold descriptions below
apply to their specific prior releases, not blanket DEV UI restarts.

## UX architecture source candidate — 2026-11-08

The owner requested a Termux-first navigation redesign and one File Manager.
The source sprint adds separate UI routes while leaving host adapters,
protected services, production sites and the live panel untouched. See the
[UX architecture checkpoint](checkpoints/2026-11-08-ux-architecture-main-menu.md).
Native Samsung G2 and browser acceptance remain OPEN; do not deploy this
source or treat the old H3.4 release gate as acceptance for new changes.

## Owner-requested production sprint disposition — 2026-11-08

**G3 HOLD; live PocketHost remains at the accepted
`e1c11e7` release.** The new source was prepared
on `main@4177314`, including relative Restic
paths, nonzero CLI results, and protection for
`wreckscanner-backup`. An owner-authorized
panel-only release was attempted behind strict
Samsung QA and full rollback gates, but **did not
stop or restart the production panel**.

`pockethost-h34-gated-production-4177314-20261108-v1`
returned terminal `failed/1`: 159 Node tests PASS,
Markdownlint 0 errors, then a nonzero `check:all`
exit during the Prettier phase without a complete
formatter diagnostic. Seven foreign service states
and both sites were preserved. Do not mark G2 or
G3 PASS; do not deploy without a fresh passing
exact-source gate.

Native ttyd remains OPEN after three SIGSEGV (-11)
isolated variants. The formatter diagnostic
`pockethost-h34-4177314-prettier-exit-native-20261108-v1`
was pending at handoff. Read [the 2026-11-08
checkpoint](checkpoints/2026-11-08-h34-api-restic-ttyd-acceptance.md)
for exact receipts before further action.

## Latest 2026-11-08 API and hardware follow-up

Read [H3.4 API and native diagnostic checkpoint](
checkpoints/2026-11-08-h34-api-restic-ttyd-acceptance.md)
before retrying anything.

- The existing live H3.4 panel remains on
  `e1c11e7`; `f16982d` passed full Samsung
  `check:all` separately and must not be retested.
- Local Agent API package preview, filesystem
  mutation of disposable data, snapshots and
  protections passed. Isolated relative Restic
  backup/check/staged restore passed; the original
  absolute backup failed on Android ancestor xattrs.
- The new Restic relative-source adapter passed
  five focused Node tests on `d1e7b10`; Prettier
  reported an issue and was fixed in subsequent
  source commits. Exact-latest-SHA G2 is not yet
  accepted.
- A bounded actual ttyd start crashed with
  SIGSEGV (-11), libwebsockets 5.1.0. HTTP 409
  is expected until the native failure is fixed.
  An isolated argv-compatibility task is still
  pending; do not claim ttyd acceptance.
- `wreckscanner-backup` was added to the protected
  runit allow-deny policy. The change exists in
  the repository only, not in the live panel.
- No full system backup, restore into HOME/PREFIX,
  package upgrades, terminal exposure, service
  restart or new panel cutover is authorized.

## Current general audit continuation — 2026-11-07

The audit starts from `main@437dd64662885caedfbc8b12a40b994c3d677a06`,
after the already accepted H3.4 G2/G3 release. The exact
documentation-only Samsung gate for that SHA returned
`done/0 PASS` in
`pockethost-h34-g3-docs-qa-437dd64-20261107-v1`.
Do not repeat it without source changes.

A post-deployment physical smoke,
`pockethost-h34-postdeploy-physical-smoke-20261107-v1`,
ended `failed/1`: four LAN routes, two original sites,
five read-only APIs, cross-origin mutation denial
and one disposable File Manager round-trip passed;
Restic backup failed before the terminal phase.
The failure cause is not yet established.

The general audit adds a narrow fail-closed Restic
nonzero-exit regression and one new unit test.
This new audit source is **not** covered by the
earlier H3.4 `check:all` PASS. Do not deploy or
claim G2 completion until the new exact-SHA Samsung
task produces a terminal result. Native Restic,
ttyd and browser tests remain separate G3 gates.
Do not replay uncertain or already accepted host
mutations. See [audit checkpoint](checkpoints/2026-11-07-general-repository-audit-repair.md).

## H3.4 current G3 release — 2026-11-07

**H3.4 is deployed on the existing Samsung PocketHost panel.**
The owner-authorized merge PR #1 produced
`main@e1c11e723105025b0f24ecf8e70974beddc0c2b5`.
Its source tree matches the accepted native G2
`cc9f47a1f7f71d7f6bdb715c98a226cf89c7d663`.
The Samsung Local Agent receipt
`pockethost-h34-post-merge-native-check-all-20261107-v1`
returned `done/0 PASS` for the complete `check:all` gate.

The guarded G3 release task
`pockethost-h34-guarded-production-cutover-e1c11e7-20261107-v1`
returned `done/0 PASS`: exact old panel ownership and source,
the two original sites and their SHA-256 file-tree digests,
all six protected runit services, PhotoMap TEST and the
trusted-LAN gateway were verified before and after the
panel-only cutover. A private H2.1 fallback snapshot was
created; no rollback was needed or exercised.

The current owner LAN panel is
`http://192.168.0.100:18878/termux`.
Restic is installed. The ttyd terminal dependency was
not installed at cutover. Its bounded installation and
post-deployment disposable Restic/File Manager/terminal
hardware checks have been submitted as separate Local
Agent tasks; **their final results are still pending**.
No real Mac Chrome click-through or broad system recovery
test is claimed. Never replace the six protected services.

[H3.4 checkpoint](checkpoints/2026-11-07-h34-full-termux-source.md).

## Historical H2.1 G3 disposition — owner SSH release, 2026-11-07

## Current H2.1 G3 disposition — owner SSH release, 2026-11-07

**H2.1 panel deployment is complete.** The owner executed a
guarded Samsung Termux SSH cutover from H2 `750c4b3` to
H2.1 `89ebf995`, returning `G3_PREFLIGHT_PASS`
and `G3_CUTOVER_PASS`. The same command verified that the
two original site directory digests, process identities,
release pointers and six protected services matched before
and after the panel-only restart. The H2 fallback code was
prepared but not exercised because the cutover passed.

Two supplied Mac Chrome screenshots at
`http://192.168.0.100:18878/sites` show both original
sites running on 19080 and 19081, retaining three and one
releases respectively, and the new **Manage versions**
buttons. This is visual browser render evidence, **not**
the version-manager button click matrix.

**Remaining optional G3 UI acceptance:** exercise history,
archived HTML/JS preview, Restore, one-use Rollback and safe
pruning from the real Chrome interface against a disposable
third site only. The native H2.1 G2 (134 Node / 29 UI) and
physical isolated version-engine test are already accepted;
do not rerun them. No Local Agent cutover task receipt was
created: this release evidence comes directly from the
owner's SSH output and screenshots.

[New owner SSH G3 checkpoint](checkpoints/2026-11-07-h21-g3-owner-ssh-cutover.md).
The previously documented G3 tool-safety HOLD below is
**historical pre-cutover context**, not the current state.

## H2.1 physical version-engine acceptance — 2026-11-07

- Owner's SSH backup comparison: `G3_BACKUP_VERIFIED`.
- Local Agent live owner/site/backup dry run
  `pockethost-h21-g3-owner-backup-dryrun-20261107-v1`:
  `done/0 PASS`; H2 preview and both original user sites
  unchanged, six services running.
- Disposable physical Termux engine acceptance
  `pockethost-h21-g3-isolated-physical-version-smoke-20261107-v2`:
  `done/0 PASS`; three releases, real archived GET/HEAD
  HTML/JS, Restore, single-use Rollback, protected prune
  rejection, obsolete pruning, subsequent restore and
  owner-verified fixture cleanup.
- The first fixture script had a test-only malformed URL;
  the fixture was safely cleaned up. The corrected
  `v2` passed. No original project process or data changed.
- H2.1 application G2 and native documentation gates
  are closed. **G3 panel cutover and LAN/UI acceptance
  remain separately open**, and require a permitted
  H2-fallback transaction, after which the original
  site hashes and services must be rechecked.

[Physical G3 evidence](checkpoints/2026-11-07-h21-g3-safety-hold-recheck.md).

## Latest H2.1 G3 preparation — native and physical evidence

- Exact-SHA documentation gate
  `pockethost-h21-final-docs-pass-51d993a-20261107-v1`
  returned terminal `done/0 PASS`: structure, docs, boundaries,
  Markdown and Prettier passed at `51d993a`.
- The owner verified both original site file-tree digests via
  SSH and all six protected services, plus the unchanged H2
  site identities, ports, PID/start ticks and release pointers.
- The read-only candidate check showed target H2.1 commit
  `89ebf99` in the QA checkout but initially absent from
  the live H2 Git object database.
- Local Agent task `pockethost-h21-g3-live-object-stage-20261107-v1`
  returned terminal `done/0 PASS`: fetched the exact approved
  H2.1 commit and critical files **into live Git object storage only**.
  The running H2 source stayed `750c4b3`; live worktree clean,
  no process restart or original-site modification.
- **Still required:** a separately accepted guarded panel
  switch with H2 fallback and a disposable third-site
  history/preview/restore/rollback/prune/cleanup acceptance.
  No G3 release result exists. Do not reissue closed QA or
  stage tasks.

[Full evidence and safety gate](checkpoints/2026-11-07-h21-g3-safety-hold-recheck.md).

## Closeout of this chat's H2.1/G3 scope — 2026-11-07

**Do not repeat completed H2.1 G2 or preflights merely to
obtain a new PASS.** Exact H2.1 application source `89ebf99`
passed 134 Node / 29 UI and remains unmodified. Samsung
read-only G3 ownership preflight is terminal `done/0 PASS`.

This chat repaired the missing H2.1 G3 archive-index entry
in `docs/checkpoints/README.md` (commit `ea5ed4d`),
then recorded the final H2.1/G3 disposition.
A single bounded, docs-only isolated Samsung QA request,
`pockethost-h21-final-docs-gate-9144f9f-20261107-v1`,
was published for exact main `9144f9fde7d65d665f90ebfb0868ccace4b46bc6`.
Its terminal receipt was **not yet observed** at this checkpoint.
Check that exact receipt; do not replay or assume PASS.
This handoff note itself is not included in the prior requested
SHA and is not independently certified. The previous
tool-safety rejection of the guarded live release remains;
there is no H2.1 G3 deployment task or terminal G3 receipt.
**Do not attempt to bypass the block.**

**Outcome: code G2 accepted; live G3 blocked/not accepted.**
The original H2 preview still served both protected user sites
at the last actual device readout. This chat's documented work
is handed off; a future independently permitted release must
satisfy the exact-owner guarded cutover, third disposable site,
rollback and immutable baseline comparison and real Mac Chrome
acceptance before changing G3 to PASS.

## Single-sprint H2.1 + G3 request — still safety-blocked

The owner explicitly requested an autonomous **single sprint** to close
H2.1 and G3. A review of the fresh `main`, installed Samsung
read-only receipt (`done/0 PASS`) and the private installation-specific
task/result collection found no H2.1 deployment attempt or terminal
G3 acceptance. G2 remains accepted; do not repeat it.

**Do not reinterpret this authorization as permission to bypass the
previous tool-level rejection.** No compliant deployment mechanism
was established in this review, so G3 remains HOLD; the original H2
preview and two user sites were not intentionally changed. Do not
try to work around the rejection by changing the payload encoding,
transport or splitting the blocked effect. Continue only through
an independently permitted guarded release route with H2 fallback.
The disposable third-site API/LAN matrix and owner Chrome gate
remain pending.

[One-sprint audit and hold details](checkpoints/2026-11-07-h21-g3-safety-hold-recheck.md).

## Latest continuation checkpoint — 2026-11-07

- Fresh reviewed `main` was `6ff3a1d79c1aefb3feee8e80f090446083cf8582`
  before this documentation-only checkpoint; H2.1 application code
  remains exactly the Samsung-G2-tested `89ebf9955bfc02e6244e0e23d4501f81187c226f`.
  Git compare showed only three documentation files changed after G2.
- **Fresh Samsung recheck PASS:** Local Agent task
  `pockethost-h21-g3-readonly-recheck-20261107-v1` ended
  `done/0` on 2026-11-07 at 11:35:54 UTC
  (12:35:54 Europe/Warsaw). Live H2 preview source, process
  PID/ticks, both owner site release pointers, filesystem
  hashes, PIDs, ports, and six protected services matched
  the prior baseline; PhotoMap TEST 8010 stayed closed.
  This proves only that point-in-time state; recheck identity
  immediately before any separately permitted G3 cutover.
  Do not replay the closed read-only task.
- **G3 remains HOLD.** The earlier guarded release was rejected
  by tool safety checks before submission. No H2.1 production
  deployment, version-manager live test, or original-site mutation
  is established. Do not circumvent that rejection through
  alternate task encoding/channel/host or unreviewed command.
- Preserve both user's live H2 sites and six protected services.
  Use a third disposable site only after compliant G3 permission,
  fresh owner/PID/ticks/filesystem verification and an H2 fallback.
- [H2.1 G3 recheck](checkpoints/2026-11-07-h21-g3-safety-hold-recheck.md).

## Active H2.1 — G2 PASS, live G3 HOLD

The user confirmed two independent working ZIP-hosted sites
in real Mac Chrome and reported successful quick rollback.
The small `Open hosted site` spacing defect and
full historical-version controls have been fixed in
source `89ebf9955bfc02e6244e0e23d4501f81187c226f`:

- List all retained immutable releases with date,
  file count, bytes and active/undo state.
- GET-only archived HTML/asset preview.
- Restore a selected historic release, retaining
  single-use quick rollback to the formerly active
  release.
- Explicitly confirmed obsolete-archive pruning,
  with active and rollback-target deletion denied.
- Do not automatically prune or migrate site data.

**Device G2 PASS:** Local Agent
`pockethost-h21-full-native-g2-89ebf99-20261107-v1`
returned terminal `done/0`, full `npm run check:all`,
134/134 Node and 29/29 UI tests, lint, TypeScript,
docs, formatting and build. Do **not** repeat
this closed exact-SHA gate unless source changes.

**Live baseline preflight PASS:**
`pockethost-h21-readonly-live-preflight-20261107-v2`
returned terminal `done/0`. The live preview was
still accepted H2 source `750c4b3fba2126647c3b593ae89d108ba2a67206`;
both user sites were running on loopback ports
19080 and 19081 with verified PID/start ticks and
SHA-256 file-tree fingerprints. All six protected
services were running and PhotoMap TEST 8010
was closed. This preflight is historical: recheck
the actual state before any future mutation.

**G3 HOLD:** A large prepared guarded release task
was rejected by tool safety checks before submission
or host execution. No H2.1 deployment was confirmed.
Do not bypass the block or assume that a draft
script ran. The existing H2 panel and the two
user-owned site directories remain the production
of this private-LAN development session.

**Next-chat mission:** resolve the permitted
mechanism for owner-verified H2.1 G3 deployment,
preserving both existing sites _bit-for-bit_.
If permitted, perform a guarded release with
source/host/PID/owner checks and H2 fallback,
then test version restore/rollback/archived GET
and safe pruning exclusively on a disposable
third site. The owner's two existing site
processes, files, versions and ports must not
be restarted, pruned or modified. Record
the owner Chrome follow-up separately.
If tool safety restrictions still block G3,
stop before any mutation and report the exact
hold rather than pretending deployment succeeded.

Canonical receipt details and exact owner-site
hashes: [H2.1 checkpoint](checkpoints/2026-11-07-h21-release-manager-source.md).
Read this first; do not repeat H2, H1 or O1 gates.

## H2 — accepted native and owner core browser workflow

**Current deployed application source:**
`750c4b3fba2126647c3b593ae89d108ba2a67206`.

- G2 `pockethost-h2-final-native-check-all-750c4b3-20261107-v2`:
  terminal `done/0 PASS`, full Samsung `npm run check:all`,
  26/26 admin UI tests, Node coverage and native quality gates.
- G3 `pockethost-h2-guarded-g3-real-static-sites-750c4b3-20261107-v2`:
  terminal `done/0 PASS`, verified old H1 owner and exact
  source before guarded cutover. Two real static projects,
  distinct loopback ports, ZIP and folder-format uploads,
  HTML/CSS/JS LAN GET, update, one-step rollback,
  verified Restart and owned logs passed. Foreign Origin,
  unsafe ZIP, missing intent and static-site POST were rejected.
  Both temporary acceptance projects were stopped and
  removed with exact owner verification; H1 demo remained
  in its real user-selected state. All six protected services
  remained running and PhotoMap TEST port 8010 stayed closed.

**Panel:** `http://192.168.0.100:18878/sites`.
Sites use the existing private GET/HEAD-only gateway:
`http://192.168.0.100:18879/h2/<site-id>/`.

The previously accepted H1 source
`1edbd1b68cb1d0f4c21796172d25c5d0da10ebab`
remains the known safe preview rollback candidate; do not
switch source or stop a process without verifying fresh
PID/start ticks and the gateway owner record.

The H2 API requires both
`POCKETHOST_ENABLE_OWNED_SITE_DEV=1` and
`POCKETHOST_ENABLE_USER_SITES_DEV=1`. They are set
for the accepted manual preview session, not auto-enabled
on boot. The admin is plaintext HTTP without login:
**trusted private LAN only, no public tunnel**.

**Owner browser evidence:** two real Chrome-owned sites,
ZIP upload, Start and independently hosted v1/v2
HTML/CSS/JS pages; owner reports Rollback also works.
Full H2.1 archive selection/cleanup remains separately pending.

**After H2.1 acceptance:** prioritize H3 package/software CMS
with dependency and update safeguards; separate
site deletion and long-term storage capacity controls. H4 remains a
separately authenticated Local Agent / AI API milestone.
No PhotoMap activation, foreign service mutation, public
API, autostart or arbitrary user backend execution
is authorized.

See [H2 checkpoint](checkpoints/2026-11-07-h2-static-hosting-source.md)
and [quality gates](QUALITY_GATES.md). Do not repeat
accepted H1/O1 tests merely because this handoff changed.

## Historical H1 and O1 acceptance

## H1 one-demo MVP — accepted and deployed

The owner requested one large Hosting MVP vertical slice. Main source now contains
the real PocketHost-owned demo project lifecycle: Create, Start, verified HTTP
health, Publish fixed v1/v2, one-use Rollback, Restart, Stop; durable bounded
deployment journal, verified PID/start ticks, owned logs, managed-projects
listing and dedicated deployment/log screens. Original template screens remain.

This is **one registered static HTML test app**, not arbitrary application
deployment or multi-project registration. PhotoMap stays catalog-only.
The LAN backend remains login-free on an owner-approved trusted private
Wi-Fi, with no WAN exposure or automatic startup.

Actual Samsung read-only preflight task
`pockethost-hosting-mvp-preflight-20261107-0622-v2` returned
terminal `done/0`: independent QA checkout clean at `faf0447`,
live PocketHost checkout clean at `f0dd506`; six protected services
running; loopback 8787 and 18787 and managed LAN 18878/18879
listening; PhotoMap 8010 closed; old demo running v2,
Network Access enabled. The first preflight
`pockethost-hosting-mvp-preflight-20261107-0616-v1`
returned `failed/125, not_started` due inadequate task-time
budget, with no host command executed. Retry corrected the budget.

**Accepted H1 application SHA:** `1edbd1b68cb1d0f4c21796172d25c5d0da10ebab`.
Samsung task `pockethost-h1-final-native-check-all-1edbd1b-20261107-v1`
returned `done/0 PASS`: 115/115 Node, 23/23 UI, lint,
types and build green. Guarded live cutover task
`pockethost-h1-guarded-g3-lan-release-1edbd1b-20261107-v1`
returned `done/0 PASS`: verified live PID/start ticks,
switched only the owned panel, restored trusted-LAN gateway,
tested v2 → publish v1 → rollback v2 → restart → stop → start,
and verified all six protected services still running and
PhotoMap TEST 8010 closed. **H1 accepted source was `1edbd1b` before H2.**

The owner then supplied real Mac Chrome screenshots showing
running/healthy and stopped project states, bounded logs,
deployment history, hosted HTML v1/v2 and a browser-originated
publish event, and reported that the experience appeared to work.
This is core browser acceptance, not exhaustive keyboard/ARIA
and negative-state evidence. The header still shows
`Template landing` on Project details; minor UX follow-up.

No generic app uploads, multi-project deployment, package
management, public AI API, production PhotoMap, autostart or
authenticated management surface were implemented as H1.

See [H1 checkpoint](checkpoints/2026-11-07-h1-hosting-mvp-source.md).

## Prior accepted O1 and private LAN history

## Resume protocol

1. Fetch the **fresh current `main` HEAD**, never assume it.
2. Read root `AGENTS.md`, [Termux runbook](LOCAL_AGENT_TERMUX.md),
   [quality gates](QUALITY_GATES.md), [roadmap](ROADMAP.md),
   [O1 checkpoint](checkpoints/2026-11-07-o1-observability-source.md),
   [live LAN acceptance](checkpoints/2026-11-07-o1-lan-live-acceptance.md)
   and [502 recovery](checkpoints/2026-11-07-o1-502-live-recovery.md).
3. All code and QA run only on verified Samsung Termux via Local Agent.
   GitHub connector is source and task transport, not execution.
   No GitHub Actions, Codex, Work, new feature branch or force push.
4. Keep six foreign services, imported PhotoMap TEST and
   PocketHost-owned P3 runtime behind strict ownership gates.

## Historical O1 implementation and accepted slice

Source `315e0632a53444038fbe159dd5a075cdc7fb72c6`
passed Samsung `npm run check:all` (including **19/19 UI tests**).
The exact-SHA guarded live task
`pockethost-lan-settings-cutover-315e063-live85a963-20261107-v1`
returned **done/0 PASS** and safely switched only the verified
PocketHost panel and its LAN gateway.

- `/observability`: on-demand host and process metrics, read-only
  packages, six-service statuses, bounded history and diagnostics.
  Android-denied CPU, battery and network counters stay unavailable.
- `/settings/network`: choose a real private Wi-Fi IPv4 address,
  manually enable/disable the current session's own LAN gateway,
  show admin and owned-demo URLs.
- Default panel upstream: `127.0.0.1:8787`.
  Current LAN admin: `http://192.168.0.100:18878/observability`.
  Network settings: `http://192.168.0.100:18878/settings/network`.
  Owned demo: `http://192.168.0.100:18879/`.
- No public ingress, autostart, background sampling,
  automatic repair, general service control or package changes.
  The home-LAN demo admin has no login and uses plaintext HTTP.

Historical earlier task `pockethost-lan-settings-guarded-live-cutover-315e063-20261107-v1`
had a successful G2, but stopped before deployment due a wrong
assumption about the old live SHA. The later accepted cutover
verified the actual old SHA and required precise process identity.

## Later accepted O1 502 correction

After Chrome reported a 502 for the long-running Observability API,
the gateway was fixed in source `f0dd506c996f700d50421b0545816c641f348bc5`.
A first guarded redeploy rolled back safely because the active Git
checkout lacked that commit; the corrected Samsung task
`pockethost-o1-502-git-fetch-repair-and-guarded-cutover-f0dd506-20261107-v2`
returned `done/0 PASS`. Exact-source `check:all` passed, including
19/19 UI tests. At that earlier O1 stage the panel ran this source; three consecutive
LAN Observability GETs returned HTTP 200 (5.71, 6.23, 5.80 seconds).
Six protected services stayed unchanged and PhotoMap 8010 remained
closed. See the [recovery checkpoint](checkpoints/2026-11-07-o1-502-live-recovery.md).

**Do not repeat the closed Git repair or G2 work without new evidence.**
Real Mac Chrome acceptance remains pending; browser testing must not
be confused with the three successful HTTP probes.

## Next work, without repeating closed gates

- Obtain the owner's real Mac Chrome acceptance of Observability
  and Network Access, including Refresh and visible reading states.
  Test only the PocketHost settings gateway toggle; do not
  infer permission to manage external listeners.
- Improve O1.3 diagnostics and per-process CPU delta as separately
  scoped work. Keep unavailable Android counters honest.
- Preserve P3 browser keyboard/ARIA, PRoot detached-orphan
  recovery and PhotoMap live activation as independent holds.
  No physical PhotoMap Start without separate authorization.

A subsequent documentation-only commit may move `main` beyond the
application-tested source SHA. Record its own docs/check results;
do not claim the old full QA applies to modified application code.
