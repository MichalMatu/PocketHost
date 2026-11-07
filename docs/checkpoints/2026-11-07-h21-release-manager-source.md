---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: H2.1 release manager scope, preservation rules and exact-SHA Samsung gates
---

# PocketHost H2.1 — history, selected restore and safe archive cleanup

## Why

The owner confirmed via real Mac Chrome screenshots that two
independently uploaded static sites work, including v1/v2 HTML/CSS/JS.
The owner also identified insufficient spacing between
`Open hosted site` and `Upload static ZIP` and requested
a complete version manager instead of only the one-step undo.

The accepted and deployed H2 application baseline is
`750c4b3fba2126647c3b593ae89d108ba2a67206`.
Existing user-created `pockethost-h2` site folders,
their exact project IDs, separate loopback ports, active releases,
previous releases, owned PIDs and session gateways are
**preserved without migration or adoption**.

## H2.1 source changes

- `host/site-fleet-host.ts`: enumerate physically present,
  bounded release directories. Each record includes release
  ID, creation date, file count, bytes, active and
  quick-rollback status. Selected restore validates the
  exact owned archive and writes a new durable `restore`
  event; the formerly active release becomes a single-use
  rollback target. Prune verifies the exact archive,
  rejects active/previous releases, quarantines one
  explicitly selected obsolete directory and deletes it
  only inside the owned project root. Version history
  records the deliberate prune event.
- `host/site-fleet-server.mjs`: GET/HEAD-only
  `/__versions/<release-id>/` previews from a validated
  archived release; active release content is unchanged.
  The separate existing LAN site gateway forwards
  `/h2/<site-id>/__versions/<release-id>/` only after
  confirming the same owned child identity.
- `apps/admin/vite.config.ts`: precise version
  inventory GET, per-release restore POST and archive
  prune DELETE. Existing Origin/Host, loopback, deliberate
  write intent, exact ID and serialized mutation gates
  still apply. No generic file path, PID, command or
  arbitrary server port accepted.
- `apps/admin/src/app/sites/page.tsx`: Manage versions
  inventory with preview, restore and delete actions,
  active/rollback-target protection, confirmation,
  errors and the improved hosted-site link spacing.
- Tests cover three real immutable releases, archived
  GET preview, selected restore and one-use rollback,
  exact-target prune, 16-release capacity recovery,
  symlink and foreign-process rejection, and browser
  interaction/disablement cases.

**Safety:** no automatic deletion, retention-policy
cleanup, restarts, or process migration. The owner's
two live site directories must not be touched by
device QA. An already running H2 site may require
an explicitly selected manual Restart once to
activate the new archived-preview server handler;
the selected Restore itself requires no Restart.
The original H2 rollback remains intact.

## H2.1 release acceptance

1. Native Samsung Termux `npm run check:all` on a clean
   exact-main SHA: source, Node and browser interaction
   tests, coverage, lint, types, build, docs and format.
2. Negative device tests with disposable fixture roots:
   active/quick-rollback prune denied, another site's
   version ID rejected, malformed/symlink release blocked,
   unverified process PID never signalled.
3. Before any live cutover, verify the running H2
   source, exact owner preview PID/start ticks,
   trusted-LAN gateway owner record, two real sites
   unmodified and all six protected services running.
4. Controlled panel-only cutover and physical LAN API
   check on **disposable** site(s). Preserve the owner's
   active releases, process identities and their
   history. On failure, return to the accepted H2
   panel without signalling either existing user site.
5. Record owner Mac Chrome preview, selected restore
   and deletion confirmation separately. Automated
   HTTP is not proof of user interaction.

## Exact H2.1 G2 and owner preflight — accepted

**Code SHA:** `89ebf9955bfc02e6244e0e23d4501f81187c226f`.
Samsung Local Agent task
`pockethost-h21-full-native-g2-89ebf99-20261107-v1`
returned **done/0 PASS** on this exact SHA: full
`npm run check:all`, 134/134 Node tests, 29/29 UI tests,
lint, TypeScript, Prettier, docs and Vite build.
Do not repeat this closed G2 without new source changes.

Read-only live device preflight
`pockethost-h21-readonly-live-preflight-20261107-v2`
returned **done/0 PASS**. The active H2 application was
still `750c4b3fba2126647c3b593ae89d108ba2a67206`;
the owned panel was PID 31592, start ticks 40515916.
The known two running user sites and their files were
recorded with exact SHA-256 tree digests:

- `site-1066192a717d4f50988ff48678bca738`,
  loopback 19080, PID 5840, ticks 40649153,
  three saved releases; tree digest
  `b67b02e5b68cb629666e4ca897137025a25b7159655aaf192450df80ca18395b`.
- `site-2ddc3464f26b46728d758924ce78fda1`,
  loopback 19081, PID 2804, ticks 40638777,
  one saved release; tree digest
  `6af83094458bcc43d78471181e0c746d39909da6c1397ff645088d3733110b7f`.

The six protected services were running and PhotoMap
TEST port 8010 was closed. These are **historical
preflight facts**, not permission to assume the same
PIDs, hashes or service states at a later cutover.

## G3 HOLD and next-chat contract

No H2.1 live release task has succeeded or been
registered on the Samsung. A proposed large guarded
G3 task could not be submitted because its tool call
was rejected by safety checks. It was **not executed**.
Do not reframe this as G3 PASS or attempt to evade
the tool block with a different encoding or channel.

Resume from a **fresh current main and device
state readout**. If an allowed, reviewable G3 mechanism
is available, use an exact-SHA guarded preview
transition and disposable test project only.
Verify both owner sites' files, active/rollback
releases, process PID/start ticks and loopback ports
before and after. Do not stop, restart, prune,
restore, delete or redeploy either user-owned site.

G3 acceptance requires live LAN tests of three
versions of one disposable project: archived
GET/HEAD HTML and JS preview, selected restore,
quick rollback, active/rollback-target deletion
refusal, deliberate pruning of an obsolete
archive, and exact fixture cleanup. Guard the
existing six services, PhotoMap TEST and the
H2 source rollback candidate. Record any browser
confirmation separately from API probes.

**Current stage: H2.1 G2 accepted, G3 HOLD;
H2 continues serving both user sites.**

See [handoff](../HANDOFF_NEXT_CHAT.md),
[H2 checkpoint](2026-11-07-h2-static-hosting-source.md)
and [quality gates](../QUALITY_GATES.md).
