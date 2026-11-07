---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Canonical H2 release and physical acceptance handoff; preserve earlier H1 and O1 evidence
---

# PocketHost — H2 static hosting sprint; H1 accepted baseline

## Active H2.1 — release manager source candidate

The owner supplied real Mac Chrome screenshots of two
new user-created static sites on ports 19080 and 19081,
each serving an uploaded ZIP with HTML/CSS/JS, and
confirmed that both work and Rollback works. The owner
reported a tight gap between `Open hosted site` and
`Upload static ZIP`, and approved continuation into
a full release manager.

H2.1 source adds inventory of all physically retained
releases, archived preview links, selected-version Restore
(with one-step undo), and explicitly confirmed removal
of only inactive, non-rollback archive directories.
It also fixes the link spacing. No automatic pruning
or data migration is authorized. The owner's two
live site IDs, contents, ports and owned PIDs must
be preserved.

**H2.1 is NOT deployed or accepted until exact-SHA
Samsung G2 and guarded G3 receipts exist.**
The live H2 application remains `750c4b3` and
is the rollback baseline. Device QA must create
only disposable fixtures and may not prune/restart
either owner's current live site. Older running H2
children may need an explicit manual Restart for
archived preview after H2.1 rollout, but restore
does not require any child restart.

See [H2.1 checkpoint](checkpoints/2026-11-07-h21-release-manager-source.md).
Do not repeat already accepted H2 smoke or
change six protected services.

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
