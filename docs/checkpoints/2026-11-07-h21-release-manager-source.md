---
status: implementation-pending-native-acceptance
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

**Status: SOURCE candidate only until device G2 and
controlled G3 terminal evidence exist.** The accepted
H2 application keeps serving the user's actual sites
during source QA.

See [handoff](../HANDOFF_NEXT_CHAT.md),
[H2 checkpoint](2026-11-07-h2-static-hosting-source.md)
and [quality gates](../QUALITY_GATES.md).
