---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Exact final native QA receipts, runtime observations and open release holds
---

# PocketHost — final native QA and handoff checkpoint (2026-11-07)

## Repository boundary and current baseline

- Repo: `MichalMatu/PocketHost`; working policy: `main` only, no force push.
- Last accepted **application source**:
  `bc5e5539ca4656e59077335b71c0875f967ea859`.
- GitHub branch read before this documentation update confirmed that SHA
  and source tree `ec1b3a1ba41fc8c6abc25bce8ac94276a60942ff`.
- Documentation-only changes after this accepted SHA are not a new
  tested application source. No production rollout follows from this checkpoint.

## Accepted Samsung Local Agent receipts

- Final exact-source `npm run check:all`:
  `pockethost-claim-final-clean-native-gate-bc5e55-20261107-v1`;
  terminal `done`, command exit 0, PASS.
- Owned live loopback P3 lifecycle:
  `pockethost-p3-owned-live-reversible-api-acceptance-20261107-v1`;
  terminal `done`, command exit 0, PASS.
- Read-only P3 and foreign-service observation:
  `pockethost-existing-panel-ownership-readonly-20261107-v1`;
  terminal `done`, command exit 0, PASS.

The final source gate ran in an isolated, verified-origin, detached Samsung
checkout and reported clean working tree after testing. Results at exact
`bc5e553` were:

- **101/101 Node tests PASS; 16/16 admin Vitest tests PASS.**
- Markdownlint, Prettier, ESLint, TypeScript, admin lint, Vite build,
  structure/doc/boundary checks and built-in coverage floors PASS.
- Coverage: **80.34% lines, 84.30% branches, 79.88% functions**.
  The disabled PhotoMap runtime host adapter reached only **37.71% lines**.
- Port 8010 (PhotoMap TEST) remained closed; no PhotoMap activation.

The independent owned-site task verified that P3 was initially running
v2 on loopback 18787, published v1 with real HTTP content, rolled back to
v2, stopped and restarted with HTTP v2 restored. Its receipt explicitly
reported all six observed external services unchanged. Final P3:
`running`, content version 2, no outstanding rollback.

## Resolved issues and bounded source result

- Earlier `check:all` Prettier/Markdownlint blockers and UI-menu timing
  failure do not reproduce at this final exact tested source.
- Neutral runtime registry, guarded process admission, PID identity and
  child observation, PhotoMap profile/launch-plan separation, P3/P4 Zod
  contracts, structured error history and dry-run recovery passed
  deterministic native source checks.
- A missing/unknown PRoot leader and uncertain startup retain an
  `unknown` recovery hold; they do not authorize forceful cleanup.

These are code and negative-test results, **not** a claim that all possible
PRoot descendant trees or recoveries are safe on real hardware.

## Open, independently gated work

- **Browser UI HOLD:** `pockethost-chromium-p3-readonly-smoke-20261107-v1`
  failed with timeout/exit 124. Chromium 156 is available, but no
  real click/keyboard/ARIA Publish/Rollback acceptance exists.
- **PRoot recovery HOLD:** detached/reparented descendants, uncertain spawn,
  stale markers and end-to-end physical safe Stop/recovery remain unproven.
- **PhotoMap activation HOLD:** stopped imported data/rootfs must remain
  disabled; no real Start, health, whole-instance rollback or release approval.
- **Knip tooling HOLD:** native `oxc-resolver` failed under Termux for
  Knip 5 and 6; do not infer dead code or remove vendor/dependencies.
  Metadata-only investigation identified historical v5 candidates without
  proving a compatible runtime.

## Safety and continuation

Read-only probes observed six foreign services running, but do not use
that historical snapshot as proof of their future condition. No outside
service, original PhotoMap, Local Agent, package estate or public ingress
was changed by these accepted P3 tasks.

Next chat must read the [current handoff](../HANDOFF_NEXT_CHAT.md),
[quality gates](../QUALITY_GATES.md), [development plan](../DEVELOPMENT_PLAN.md),
[Termux Agent runbook](../LOCAL_AGENT_TERMUX.md) and root `AGENTS.md`
before a new task. Verify fresh `main` HEAD, current private agent
host/installation and ownership preflight. Prioritize real P3 browser
acceptance, then PRoot orphan recovery. Seek separate explicit permission
for any real PhotoMap Start.

Previous sprint records are archived separately; they remain historical
evidence rather than active contradictory handoffs.
