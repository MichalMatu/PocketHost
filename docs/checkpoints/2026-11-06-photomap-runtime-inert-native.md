---
status: accepted-with-follow-up
owner: runtime
last_reviewed: 2026-11-06
purpose: Record same-SHA Samsung native acceptance of the fail-closed PhotoMap runtime candidate before any PRoot activation
---

# PhotoMap isolated runtime — inert adapter acceptance

## Accepted code and exact device evidence

The new source is on the existing `sprint/p3-mvp-integration-20261105` branch at **`32c09f2c4a92b918f919f67570a27b0a7193ea9a`**. It adds:

- `src/shared/photomap-runtime.ts`: a typed, single-instance `photomap-test` lifecycle port, fixed loopback port 8010, explicit ownership and disabled-by-default status.
- `src/modules/runtime/photomap-runtime.ts`: a policy layer rejecting foreign ownership, unknown process state, invalid runtime versions and launch without approval; it bounds and redacts event logs.
- `src/modules/host/photomap-runtime-host.ts`: a **non-activated candidate** for versioned Debian PRoot with canonical owned-path checks, fixed launch arguments, manifest/release guards, exact PID/start-ticks/executable/cwd/argv verification, port check, graceful verified-only signal, health probe, and private event records.
- `tests/quality/photomap-runtime.test.mjs` and `tests/quality/photomap-runtime-host.test.mjs`: nine dedicated tests, including forged owner, wrong port/release, symlinks, partial enablement, unknown process, log redaction and idempotent manual policy.

Samsung Local Agent terminal task **`pockethost-photomap-runtime-native-final-gate-20261106-v4`** finished **done, exit 0**, reporting `NATIVE_RUNTIME_INERT_PASS`. The pinned clean source passed `npm run check`: **60/60 Node tests**, **64 Markdown files / zero errors**, Prettier, ESLint and TypeScript. An additional targeted `node --test` run passed **9/9** new tests. The adapter directly inspected the real imported instance and verified `state=disabled`, `release=import-20261106`, `startDenied=true`, `stopDenied=true`. The actual port 8010 remained off and the six monitored external Termux services were running.

Historical pre-closeout: `pockethost-photomap-runtime-candidate-native-20261106-v1` passed five policy tests but exposed an unused import; `pockethost-photomap-runtime-native-closeout-20261106-v2` passed lint/types but found Prettier drift. The targeted on-Samsung Prettier diff was applied in `32c09f2`; an initial QA script guard counted two diff hunk headers incorrectly and failed safely before affecting the checkout. The corrected `v4` task closed the complete gate. Do not repeat these results without a new source change.

## Explicit non-acceptance and next gate

This checkpoint accepts **code quality and real-world denial of unapproved lifecycle operations**, not a runnable PhotoMap instance. The existing `runtime.json` still requires `enabled=false`, `launch_allowed=false`, `autostart=false`, `managed_proot_snapshot=false`. The external `photomap-dev` Debian PRoot is neither adopted nor snapshotted. No independent rootfs, project-local Python dependency image, managed runtime work database, health-tested child PID or backend stdout collection has been accepted. The app's P4 read-only UI has no PhotoMap lifecycle controls.

Next: inspect exact source rootfs provenance, footprint and active PRoot sessions **read-only**. Only then stage a project-local versioned copy with owner-only paths and independent working SQLite; do not run `proot-distro backup` against the original if it can alter source permissions. Run separate same-SHA tests of the isolated interpreter and lifecycle, with a guaranteed manual Stop and verification of port 8010 off. PhotoMap's original checkout, imported source/data, backups, P3 site, Local Agent and all external services must remain untouched. Package mutations and whole-instance rollback stay disabled until tested restoration of Python, SQLite/migrations and media.

See [ADR-0009](../adr/0009-photomap-isolated-runtime.md) and [handoff](../HANDOFF_NEXT_CHAT.md).
