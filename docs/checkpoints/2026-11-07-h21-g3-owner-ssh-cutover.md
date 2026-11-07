---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Record owner-executed H2.1 live panel cutover and bounded G3 evidence
---

# PocketHost H2.1 — owner SSH G3 cutover (2026-11-07)

## Scope and provenance

The owner ran a guarded Python command directly in the Samsung
Termux SSH session. This is **owner-supplied SSH output**, not a
Local Agent terminal task receipt. The assistant did not execute
the cutover. The command explicitly targeted only the PocketHost
admin preview and its session-owned trusted-LAN gateway.

- Prior running panel: H2
  `750c4b3fba2126647c3b593ae89d108ba2a67206`.
- Deployed H2.1 application:
  `89ebf9955bfc02e6244e0e23d4501f81187c226f`.
- Live checkout:
  `~/Projects/PocketHost-P3-MVP-ReleaseQA-20261106`.
- Owner's exact terminal markers: `G3_PREFLIGHT_PASS`,
  `G3_CUTOVER_PASS`.
- Reported panel URL:
  `http://192.168.0.100:18878/sites`.

## Guards and postflight performed in the owner's command

The command verified the clean H2 Git checkout, H2.1 object
availability, two identical owner-created backup files,
the preview and gateway ownership records, old panel PID/start
ticks, the loopback/LAN listeners, inactive PhotoMap TEST port
8010, all six protected runit services, and both original
user-site file trees and owned process identities.

It terminated the verified **panel** process group, switched
the live checkout to the tested H2.1 SHA, started the manual
Vite admin with the two owned-site feature flags, re-enabled
the session-owned LAN gateway, and tested loopback and LAN
HTTP routes. It compared original-site SHA-256 tree digests,
process IDs/start ticks, ports, release pointers and six
service PIDs against its preflight baseline. All guards
returned successfully before `G3_CUTOVER_PASS`.

The script included an attempted automatic H2 fallback on
post-cutover errors. Because the cutover succeeded, the
fallback was not exercised; do not record a live rollback
test from this result. The previously verified original H2
preview/gateway backups remain available.

## Browser observation

The owner supplied two real Mac Chrome screenshots at
`http://192.168.0.100:18878/sites`.

- The H2.1 **Manage versions** control is visible on both
  original user-site cards.
- Site `site-1066192a717d4f50988ff48678bca738` is
  shown as running on loopback port 19080 with three releases.
- Site `site-2ddc3464f26b46728d758924ce78fda1`
  is shown as running on loopback port 19081 with one release.
- Existing deployment history and hosted-site controls
  remain visible. This is visual browser evidence, not a
  recorded click-through of the new version-manager dialog.

## Reused accepted evidence

- H2.1 native application G2: Local Agent task
  `pockethost-h21-full-native-g2-89ebf99-20261107-v1`,
  terminal `done/0 PASS`; 134 Node / 29 UI tests.
- Physical version engine in a disposable isolated Termux
  site: `pockethost-h21-g3-isolated-physical-version-smoke-20261107-v2`,
  terminal `done/0 PASS`; archived GET/HEAD, selected
  Restore, one-use Rollback, protected and obsolete pruning,
  and exact fixture cleanup.
- Owner-verified backup marker: `G3_BACKUP_VERIFIED`.

## Disposition and handoff

**H2.1 panel cutover: PASS (owner SSH evidence).**
**LAN /sites render and two original sites: PASS (owner screenshots).**
**Original-site/service invariants: PASS (owner command output).**
**H2.1 version engine on disposable Termux fixture: PASS (Local Agent).**

**Open:** manual Mac Chrome click-through of **Manage versions**
(history, archived preview, restore, one-use rollback and
prune denial), preferably on an explicitly disposable third
site. There is no evidence here of a new live third-site
interaction matrix. Do not risk or modify the two original
sites to complete this optional interface-level evidence.

Source and owner-tested live SHA remain `89ebf995`.
Later documentation commits do not deploy additional code.
Do not repeat closed G2 or isolated physical engine tests.
See [handoff](../HANDOFF_NEXT_CHAT.md) and
[historical hold](2026-11-07-h21-g3-safety-hold-recheck.md).
