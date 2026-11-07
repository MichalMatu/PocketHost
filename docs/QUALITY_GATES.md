---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Current PocketHost source, hardware and release acceptance contract
---

# Quality Gates

## Execution and evidence

PocketHost commands run only on the exactly addressed Samsung Termux Local Agent.
GitHub Connector moves source and private task/result data, not test execution.
No GitHub Actions, Codex, ChatGPT Work or Mac/Linux fallback. A gate is PASS
only with a terminal receipt, exact tested source SHA, exit code and scope.
Do not carry a native result to a later code SHA or infer deployment from code.

## G0 — foundation and safety

`npm run check:foundation` checks the manifest, document links/frontmatter,
module boundaries and Node negative tests. Discovery is read-only; only
explicitly registered PocketHost-owned processes may receive lifecycle calls.
Ownership cannot be inferred from names, ports or discovered processes.

## G1 — source quality

`npm run check` includes G0, Markdownlint, Prettier, ESLint and TypeScript.
Use pinned lockfiles and qualified device tools. Do not weaken gates to
hide platform-specific failures.

## G2 — full source and UI tests

`npm run check:all` runs G1, the Node coverage floor (75% lines,
78% branches, 78% functions), admin lint/build and Vitest interactions.
It covers source contracts and deterministic negative cases, **not**
actual browser clicks or live PRoot orphan cleanup. Record exact source SHA.

## G3 — physical browser, host and release

Before and after any owned runtime mutation, verify the target ownership,
loopback binding, process identity and all six protected foreign services.
Release of changed P3 UI requires actual browser Publish/Rollback,
keyboard/ARIA/version-selection and failure-state evidence. PhotoMap requires
separately approved controlled Start/health/Stop and whole-instance
source/SQLite/media restore on disposable data. A PRoot child snapshot or
process-group check alone is not an exhaustive orphan proof.
No public administration, autostart or package mutations by default.

## Accepted 2026-11-07 baseline

At `main@bc5e5539ca4656e59077335b71c0875f967ea859`,
Samsung receipt `pockethost-claim-final-clean-native-gate-bc5e55-20261107-v1`
returned `done/0`: **101/101 Node**, **16/16 admin Vitest**, all
`check:all` gates PASS; QA checkout clean and PhotoMap port 8010 closed.
Coverage was **80.34% lines, 84.30% branches, 79.88% functions**.

Separate Samsung receipt
`pockethost-p3-owned-live-reversible-api-acceptance-20261107-v1`
returned `done/0`: real owned loopback P3 Publish → Rollback → Stop →
Start with HTTP verification, leaving all six external services unchanged.
This closes the prior P3 native/API lifecycle check, **not G3 browser UI**.

## Outstanding release holds

- Chromium read-only render timed out (exit 124); real P3 browser and
  keyboard/accessibility acceptance is **not passed**.
- PhotoMap live runtime, orphan/reparented-descendant recovery and complete
  restoration are **not accepted**; continue to deny Start.
- Knip v5/v6 fail in Termux on native `oxc-resolver` loading.
  Knip remains informational and cannot justify dependency pruning.
- Documentation-only commits after the accepted source baseline require
  their own documentation checks; they do not retroactively change that
  accepted application-source result.

See the [current handoff](HANDOFF_NEXT_CHAT.md) and
[final Samsung checkpoint](checkpoints/2026-11-07-final-native-qa-handoff.md).

## O1 Observability and private LAN acceptance

The exact application source `315e0632a53444038fbe159dd5a075cdc7fb72c6`
passed Samsung `npm run check:all` including 19/19 UI interactions.
The guarded live handover
`pockethost-lan-settings-cutover-315e063-live85a963-20261107-v1`
returned done/0 PASS for the owned PocketHost preview and LAN gateway.
The source test is accepted; actual new-version Mac Chrome interaction
is not yet recorded. See the [live checkpoint](checkpoints/2026-11-07-o1-lan-live-acceptance.md).

Documentation-only follow-up commits must pass their own docs gates;
application source changed after this SHA requires a fresh full test.

New host/process metrics must pass negative
tests for inaccessible Android `/proc` and
`/sys`, stale or missing readings, PID reuse,
foreign-owner classification, output bounds,
history retention and secret redaction.

Prove actual Samsung metric availability,
safe sampling limits, unchanged six protected
services and unchanged PhotoMap port 8010.
Collect exact source SHA and terminal task
results. UI jsdom tests do not substitute
for browser interaction tests.
No process signals, autostart, package
changes, automatic recovery or PhotoMap
activation are allowed within O1.
See [the roadmap](ROADMAP.md) and
[ADR-0010](adr/0010-read-only-observability.md).

## O1 502 guarded repair — later live acceptance

At source `f0dd506c996f700d50421b0545816c641f348bc5`,
Samsung task
`pockethost-o1-502-git-fetch-repair-and-guarded-cutover-f0dd506-20261107-v2`
returned terminal done/0 PASS after repairing the missing Git object
in the _owned_ live checkout. `npm run check:all` passed,
including 19/19 UI tests. The exact live source matched `f0dd506`;
3/3 Observability LAN GETs returned 200 (5.71, 6.23, 5.80 seconds).
Six protected services remained unchanged and PhotoMap 8010 closed.
Mac Chrome new-version interaction remains G3 HOLD.
See the [recovery checkpoint](checkpoints/2026-11-07-o1-502-live-recovery.md).

## H1 accepted single-demo MVP — exact-source evidence

The Samsung terminal receipt
`pockethost-h1-final-native-check-all-1edbd1b-20261107-v1`
returned `done/0 PASS` for
`1edbd1b68cb1d0f4c21796172d25c5d0da10ebab`:
115 Node tests, 23 admin Vitest tests, lint, TypeScript and
Vite build passed. Coverage: 82.10% lines, 82.78% branches,
80.54% functions. The QA tree remained clean.

The separate guarded LAN release task
`pockethost-h1-guarded-g3-lan-release-1edbd1b-20261107-v1`
returned `done/0 PASS` on the same source: exact old live
PID/start ticks and source were verified before cutover;
the owned-demo v2 → publish v1 → rollback v2 → restart →
stop → start round trip passed with HTTP content, history
and bounded-log verification. Six protected services remained
running and PhotoMap TEST 8010 closed.

The owner's real Mac Chrome screenshots show the H1 project
running/healthy and stopped, v1 and v2 hosted content,
deployment history, logs and a browser-originated publish.
The owner reported that the experience appeared to work.
This supports **core H1 browser acceptance**, while exhaustive
keyboard/ARIA and negative-state browser checks remain a
distinct follow-up. The former `Template landing` header was a non-blocking
H1 UX defect, corrected in the separately tested H2 source.

This closes the scoped **one fixed demo, two fixed releases**
MVP, not generic hosting, PhotoMap execution or public
administration. The accepted application source stays
`1edbd1b` after documentation-only follow-up commits.
See [H1 checkpoint](checkpoints/2026-11-07-h1-hosting-mvp-source.md).

## H2 static hosting — Samsung G2/G3 accepted

Application source `750c4b3fba2126647c3b593ae89d108ba2a67206`
passed the full exact-SHA Samsung
`npm run check:all`, including 26/26 admin interaction
tests, Node test/coverage gates, lint, TypeScript,
Prettier, documentation checks and build.

Receipt: `pockethost-h2-final-native-check-all-750c4b3-20261107-v2`,
terminal `done/0 PASS`.

Guarded native release receipt:
`pockethost-h2-guarded-g3-real-static-sites-750c4b3-20261107-v2`,
terminal `done/0 PASS`. The task verified the
original H1 process PID and start ticks, source,
owner record, trusted LAN and unrelated services.
It switched only the PocketHost-owned preview and
re-enabled the exact private-LAN gateway.

On that live instance it created two independently
owned sites, uploaded a bounded ZIP and folder-format
bundle, served actual HTML/CSS/JS assets by LAN,
published an update and verified one-use rollback,
checked running process identity and Restart,
inspected bounded logs, and denied unsafe ZIP,
foreign Origin, missing intent and static-site
POST. Its own test projects were safely stopped
and removed; the existing H1 demo was preserved.
All six protected services remained running, and
PhotoMap TEST port 8010 remained closed.

**Accepted:** Samsung device G2 and G3 for local
static-site H2. **Not yet accepted:** the owner's
actual Chrome ZIP/folder-button interactions,
exhaustive keyboard/mobile accessibility, automatic
startup, public administration or authenticated
multi-user hosting. H2 is manual trusted-LAN HTTP
development only; no unauthenticated public access.

Documentation-only commits after the tested
`750c4b3` require docs checks but not a repeat of
the accepted H2 application hardware lifecycle.

See [H2 checkpoint](checkpoints/2026-11-07-h2-static-hosting-source.md).

## H1 Hosting MVP release criteria

The exact new source SHA must pass all existing G0–G2 gates on the
Samsung Termux Local Agent. New negative cases cover missing-intent
or cross-origin write rejection, malformed owner marker, forged PID,
port conflict, symlinked release archive, duplicate Start/Publish,
bounded deployment metadata and unowned-process noninterference.

G3 requires a **real** owned demo cycle:
Create if absent → Start → GET site (instance identity) →
Publish the opposite fixed release → HTTP content verification →
Rollback once → HTTP previous content restored →
deny second Rollback → Restart/Stop/Start, owned logs and process
identity check. A preexisting demo may be used without re-creating it.
Browser and LAN API checks must use the exact newly deployed source.

Before and after, compare the six protected runit services and ensure
PhotoMap 8010 remains closed. Never signal an uncertain PID. A failed
or uncertain rollback, mismatched checkout SHA, stale owned process
record or unavailable device evidence blocks the live panel switch.

No history of a different source SHA proves this release. Source-only
`[skip ci]` commits are not a G2 result or deployment receipt.
