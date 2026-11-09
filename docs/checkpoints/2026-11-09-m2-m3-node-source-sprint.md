---
status: source-implemented-validation-open
owner: hosting
last_reviewed: 2026-11-09
purpose: Compact M2/M3 Node Hosting source sprint and exact native evidence
---

# PocketHost — M2/M3 Node Hosting source sprint

## Scope and source state

Work exclusively on `MichalMatu/PocketHost` main. Reuse the existing H2
static hosting, the single Termux runit service manager and Restic.
No production service, tunnel, SSH, existing site or Local Agent was
altered. No packages were installed and no Node user service was started.

M2 code adds a pure, fail-closed health decision policy and explicit
Node/npm toolchain review. The npm manifest and lockfile validator
remains the entry point for source dependency plans. Its pure
implementation now lives in `src/shared/node-dependency-plan.ts`,
with the existing packages API retained as a re-export.

M3 adds `NodeProjectHost`: user-created private projects, strict
JSON and Node entrypoint validation, bounded staging, immutable
source release candidates and previous-candidate selection.
The DEV-only, loopback-restricted `/api/v1/node-projects` API is
feature flagged, serialized and guarded by browser intent.
The React Projects page integrates create, source edit, release
inventory and candidate restore with the host API.

A **candidate is not an active release**. No npm installation, build,
runtime start, readiness assertion, live logs, network publish or
running-release rollback has yet been implemented. The UI explicitly
reports the unprovisioned runtime. H2 is unchanged.

## Exact Samsung QA evidence

- `c9352623f9f55e5fe3c269330b191453ed009763`:
  10 native tests passed, one test module could not load because a
  TypeScript constructor parameter property was unsupported by the
  native strip-only loader. Root TypeScript and documentation passed;
  focused UI Vitest passed 1/1. Six changed files required formatting.
  This entire gate is **NOT PASS**.
- `033bd4153d62cbaedf81ab075219dcafbc13f720`:
  constructor syntax and a negative test assertion corrected.
- `a956c9e26d5c75e5862a6b2d20dd252e93461109`:
  six sources formatted using output from the verified Samsung
  Termux Local Agent without running project commands elsewhere.
  A targeted final gate was submitted; do not infer PASS until its
  exact terminal result is read.
- This checkpoint further repairs a module boundary and unused test
  imports. Its source changes require new SHA-specific validation.

## Open acceptance

M2: one shared runit SupervisorAdapter, authoritative desired/observed
lifecycle and ownership verification, integrated health decisions,
owned Restic backup/restore and registry coordination remain open.

M3: controlled dependency install/build, loopback port allocation,
one genuinely isolated Node service, readiness, logs, local publish,
update and last-good rollback remain open. Runtime activation requires
fresh provenance, permission and real device checks.

M4/M5 were not advanced while the critical M2/M3 runtime path remained
incomplete. No new public service or automatic startup authority was
granted.

## Next implementation

Complete the first zero-dependency Node service through the existing
runit adapter: exact owner registration, manually disabled default,
controlled start, loopback readiness identity, bounded logs and
failed-start rollback. Test only disposable PocketHost-owned resources
on Samsung. Never adopt or restart unrelated processes.
