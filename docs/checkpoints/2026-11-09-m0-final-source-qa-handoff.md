---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Source-exact M0 Samsung QA outcome, resolved Markdownlint defect and handoff without live-service mutations
---

# PocketHost M0 — source QA results and next-chat handoff

## Decision and exact evidence

**Decision: HANDOFF READY / M0 final PASS OPEN.**

The owner requested a check of Local Agent results and a decision on moving
to a new chat. At the time of inspection, PocketHost `main` was
`c97132c63a8e2da9623113be4a7b9d54c07991c4`.
The native Samsung S22 task
`pockethost-m0-final-source-checkall-s22-c97132c6-20261109-v1`
finished `failed/1` on the **clean isolated QA checkout** at that
exact commit; the reported overall status was `OPEN`. It must not
be represented as a full quality PASS.

Its component results:

- **PASS:** top-level `npm test` **196/196**,
  including H2 isolated static site create/publish, health and rollback
  tests, and source structure, documentation and module-boundary checks.
- **PASS:** focused host/PhotoMap tests **18/18**.
- **PASS:** scoped UI interaction tests **18/18**
  (H2 websites, Termux center, legacy PhotoMap and host status).
- **BLOCKED:** full `npm run dev:full` stopped during Markdownlint
  with three `MD012/no-multiple-blanks` violations in
  `docs/HANDOFF_NEXT_CHAT.md` at the then-current lines
  **10, 22 and 32**. Therefore downstream full-gate
  formatting, coverage thresholds, lint, TypeScript, admin build
  and all-UI matrix were **not** evaluated by this full-gate command
  at that SHA. Earlier focused source tests do not substitute for those
  full-gate checks.
- The QA worktree remained clean and its HEAD matched the pinned SHA.
  It performed no production panel restart, hardware feature acceptance,
  Cloudflare update, foreign service control or workload migration.

The three extra blank lines have subsequently been corrected in
`docs/HANDOFF_NEXT_CHAT.md` by docs-only commit
`118d399663acf8d2a309a34dc87c722c9ac28c66`.
That fix is source-published but **not yet accepted by a new native
full quality receipt**.

## Completed coding scope retained from M0

- Separated Hosting-owned H2 website lifecycle, release history and
  bounded file inventory from generic System Services, Backups and File
  Manager views.
- Preserved H2 ZIP/folder publishing, exact process owner markers,
  release restore/rollback, LAN preview and old route compatibility.
- Moved PhotoMap TEST diagnostic event reading out of generic
  `/api/v1/observability` and into a dedicated, fixed,
  GET-only legacy `/api/v1/managed-photomap/events` endpoint;
  bounded/sanitized records only, explicit inspection in legacy UI.
- Extracted historical six-service status aliases to
  `src/modules/host/observed-service-catalog.ts`;
  generic labels and strictly **external-only** ownership preserve
  old API IDs without creating another runit inventory.
- Kept historical P3 Demo and PhotoMap compatibility URLs and their
  guarded no-autostart behavior intact.
- M1 declarative registry and M2 npm dependency previews already exist
  as initial pure source contracts. Their implementation does not
  mean persistent host service ownership, durable project storage or
  M3 Node hosting are finished.

See [M0 UI source checkpoint](2026-11-09-m0-implementation-ui-separation-sprint.md),
[PhotoMap separation](2026-11-09-m0-photomap-diagnostics-isolation.md),
[generic services follow-up](2026-11-09-m0-generic-services-prehandoff.md),
[roadmap](../ROADMAP.md) and [quality gates](../QUALITY_GATES.md).

## Exact next-chat procedure

1. **Fetch fresh `main`** and current `agent-control`;
   do not trust the HEAD above as still current, or overwrite work from
   another active chat.
2. **Use the existing QA evidence** from
   `pockethost-m0-final-source-checkall-s22-c97132c6-20261109-v1`
   rather than repeating those successful 196 + 18 + 18 tests
   unnecessarily. Verify the three MD012 lines were removed.
3. Run a new, exact-source native Samsung QA gate on an **isolated
   clean checkout** through the Local Agent: at minimum Markdownlint,
   Prettier, TypeScript, root/admin ESLint, build, and the
   unexecuted coverage/all-UI checks, with the standard
   `npm run dev:full` only if necessary for formal complete PASS.
   Observe the real `task-results`, do not infer completion.
4. If any check fails, fix only the confirmed issue and rerun the
   smallest affected gate before attempting formal full PASS.
5. **M0 live/physical acceptance remains OPEN**: no currently
   verified deployment of this exact final source SHA to the phone,
   fresh disposable H2 Create/Publish/HTTP/Rollback, protected
   runit-service state comparison, LAN check or independent
   Agent continuity check was performed in this handoff.
   Do not restart or reconfigure live services merely to validate
   documentation.
6. After accepted M0 source and explicitly approved live checks,
   continue the next small M1 persistence/positive ownership slice,
   preserving existing H2 and Termux service guards. M2 shared
   reliability and M3 Node.js Hosting MVP remain separate gates.

## Hard restrictions

No Codex, ChatGPT Work or GitHub Actions. Use GitHub Connector for
source and existing Local Agent on **Samsung Termux** for native
tests/host activity. Avoid force-push, global package upgrades,
double supervisors, implicit service adoption, unreviewed
Cloudflare exposure and self-cutover of the Local Agent.
External IleStoi, PhotoMap, SSH, Cloudflare and Agent services are
not automatically PocketHost-owned.

**Checkpoint outcome:** good boundary for a new chat; **M0 functional
code largely ready, formal complete QA and fresh physical verification
still OPEN**.
