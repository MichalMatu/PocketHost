---
status: blocked-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Record fresh Git and Samsung control-plane review, the submitted read-only recheck and the continuing H2.1 G3 release safety hold
---

# PocketHost H2.1 — G3 safety hold recheck (2026-11-07)

## Verified repository state

- Fresh `main` HEAD at this review: `6ff3a1d79c1aefb3feee8e80f090446083cf8582`.
- Exact H2.1 **application** SHA previously verified on Samsung:
  `89ebf9955bfc02e6244e0e23d4501f81187c226f`.
- GitHub compare `89ebf99...6ff3a1d`: three commits affecting only
  `docs/HANDOFF_NEXT_CHAT.md`,
  `docs/QUALITY_GATES.md`, and
  `docs/checkpoints/2026-11-07-h21-release-manager-source.md`.
  There is **no application source change** after the accepted G2.
- Do not repeat G2: Samsung result
  `pockethost-h21-full-native-g2-89ebf99-20261107-v1`
  is already terminal `done/0` with 134/134 Node and 29/29 UI,
  lint, types, docs, formatting and build PASS.

## Physical Samsung control channel and fresh recheck

The pre-existing private Local Agent `agent-control` namespace identifies
Samsung Termux `android-termux-10520`, installation
`6be16f1d-194b-4f07-b377-3d4bb218fcd7`.
This is host/installation identity, **not** a PocketHost project binding.

The previously accepted read-only terminal receipt
`pockethost-h21-readonly-live-preflight-20261107-v2`
finished `done/0` on 2026-11-07 at 10:37:53 UTC. At that historical
instant the live PocketHost admin source was H2
`750c4b3fba2126647c3b593ae89d108ba2a67206`;
the two user's sites had independently verified exact process
identity, loopback ports, release pointers and filesystem digests:

| Protected site | Loopback port | PID / start ticks | Release count | SHA-256 tree digest |
| --- | --- | --- | --- | --- |
| `site-1066192a717d4f50988ff48678bca738` | 19080 | 5840 / 40649153 | 3 | `b67b02e5b68cb629666e4ca897137025a25b7159655aaf192450df80ca18395b` |
| `site-2ddc3464f26b46728d758924ce78fda1` | 19081 | 2804 / 40638777 | 1 | `6af83094458bcc43d78471181e0c746d39909da6c1397ff645088d3733110b7f` |

Six protected runit services were running and PhotoMap TEST
`127.0.0.1:8010` was closed at that historical preflight.
**None of these historical PIDs/hashes is a fresh deployment grant.**

To obtain a fresh device readout without mutation, a new
**read-only-only** task was published to the same verified Samsung
installation via GitHub Connector:

- Request: `pockethost-h21-g3-readonly-recheck-20261107-v1`.
- Transport commit: `b0f8d31df943b62c3b7c7ed7981871b5a2053b78` on
  `local-agent:agent-control`.
- Payload: previously accepted read-only H2.1 ownership / site
  preservation preflight; no release, restart, restore, delete,
  package command or test-site creation.
- **Receipt at checkpoint creation: NOT YET OBSERVED.**
  A published request alone is not terminal execution evidence.
  Check the exact task's `task-results/` path before assigning a
  PASS/FAIL/UNKNOWN. Do not replay while it could be pending.

## G3 decision: HOLD, not deployed

The earlier proposed large guarded H2.1 G3 release request was
**rejected by tool safety checks before publication**. No H2.1
live cutover, Restore, Rollback, archived GET, or pruning acceptance
was performed. Do not bypass that tool restriction by changing task
encoding, splitting a prohibited effect, switching transports,
using a different host, or executing directly elsewhere.

No production site, release, service, process or gateway was
intentionally changed by the operations in this checkpoint.
Without a fresh terminal device receipt, do not claim current
phone files/processes are independently reverified.

**H2 remains the accepted active production/dev preview baseline.**
The H2.1 version-manager code is accepted at G2 but G3 is OPEN/HOLD.
The sprint is **not physically closed**. No H3 or H4 work begins.

## Next handoff — exact continuation

1. Read the terminal result for the already published Samsung
   `pockethost-h21-g3-readonly-recheck-20261107-v1`;
   do not publish another duplicate task while pending.
   If the result failed/changed/UNKNOWN, diagnose read-only and
   leave live H2 untouched.
2. Recheck fresh PocketHost `main` and verify H2.1 application
   files remain identical to `89ebf99`; do not repeat accepted
   134 Node / 29 UI G2 merely because docs changed.
3. Resolve the **permitted, explicitly reviewable** owner-verified
   G3 mechanism without circumventing the earlier tool-level
   rejection. If no compliant mechanism exists, remain HOLD.
4. Only with a permitted G3 and fresh exact process/source/owner
   and PID/start-tick checks: perform a panel-only H2.1
   transition with an H2 fallback and compare both user's site
   digests, active/rollback pointers, PIDs/ticks, loopback ports
   and all six protected services **before and after**.
   No restart, migration or mutation of either original site.
5. Use only one newly created, deliberately disposable **third
   test site** for three distinct releases, history metadata,
   archived HTML/JS GET/HEAD, selected Restore, one-use quick
   Rollback, active and rollback-target prune denial, explicit
   obsolete-archive pruning and verified exact-owner cleanup.
6. Obtain and log the owner's real Mac Chrome visual and click
   confirmation separately; HTTP tests are not browser evidence.
   Record one terminal G3 result, exact deployment SHA, H2
   fallback outcome, invariants and a new final checkpoint.

Source detail: [H2.1 checkpoint](2026-11-07-h21-release-manager-source.md).
Canonical continuation: [handoff](../HANDOFF_NEXT_CHAT.md).
