---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Record the Samsung O1 LAN proxy 502 repair and guarded live recovery
---

# PocketHost O1 — LAN Observability 502 recovery

## Exact source and terminal evidence

Application source and live panel: `f0dd506c996f700d50421b0545816c641f348bc5`.
The source changes introduced a bounded 25-second upstream timeout
for Observability GET requests, leaving the normal gateway limit
and separate services unchanged.

- Earlier attempted cutover
  `pockethost-o1-502-guarded-native-g2-and-live-cutover-f0dd506-20261107-v1`
  failed before restart because the live checkout lacked the target
  Git object. Its rollback kept the old panel and gateway.
- Read-only diagnosis
  `pockethost-o1-502-live-git-tree-diagnostic-20261107-v1`
  found the live checkout at `315e063`, with target Git object absent,
  whereas the isolated QA checkout held the tested `f0dd506`.
- Corrected task
  `pockethost-o1-502-git-fetch-repair-and-guarded-cutover-f0dd506-20261107-v2`
  returned terminal `done`, command exit `0` and report `PASS`.
  It fetched the target object into the owned live checkout,
  verified commit, tree, critical blobs and process identity,
  then switched the owned PocketHost panel and gateway.

## Physical Samsung acceptance

- Exact-source `npm run check:all`: exit 0, including 19/19
  admin Vitest interactions and successful admin build.
- Three actual GETs to Observability through trusted LAN:
  HTTP 200 in all three; elapsed 5.71, 6.23 and 5.80 seconds.
- Invalid Origin: HTTP 403; demo write POST: HTTP 405.
- PocketHost-owned demo unchanged; six protected Termux
  services running and unchanged; PhotoMap TEST port 8010 closed.
- Confirmed live source: `f0dd506c996f700d50421b0545816c641f348bc5`.
  This is a bounded successful regression sample, not a promise
  that every future Observability request will finish in time.

## Remaining holds

Real Mac Chrome visual and interactive acceptance of
`/observability` and `/settings/network` is **still open**.
Previous P3 keyboard/ARIA browser acceptance, PRoot orphan recovery
and PhotoMap live activation remain independent release holds.
No extra service mutation, autostart or public WAN exposure is authorized.

The live result precedes this documentation-only checkpoint commit.
Run documentation checks for the new docs SHA through the exact
Samsung Local Agent and record the result separately.
See the [handoff](../HANDOFF_NEXT_CHAT.md).
