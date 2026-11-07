---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Canonical post-O1 and trusted-LAN handoff
---

# PocketHost — O1 and private LAN handoff

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

## Current implemented and verified slice

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
19/19 UI tests. The panel now runs this source; three consecutive
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
