---
status: active
owner: core
last_reviewed: 2026-11-16
purpose: A8 development handoff with exact live SHA and QA release gate
---

# PocketHost — Galaxy A8 handoff

## Current verified state

- **Device:** paired Samsung Galaxy A8, official Termux, PocketHost-owned DEV only. Never use Mac, S22, Codex, Work, GitHub Actions or schedulers for this flow.
- **Latest verified live source:** `eff74e52b0c73b0a43c3c1fd96244f8fbe3d2819` (2026-11-16), PID **27589**, HTTP **200**, protected services unchanged. Terminal A8 task `pockethost-a8-hosting-release-content-gate-fast-flow-20261116-v1`: done/exit 0/PASS. The previous 7/7 QA on `c0bf02184c804d93fca7a50cddbdd9b1146ee2c8` is historical, not current-SHA coverage. No reboot, SSH, WAN or real backup/restore performed.
- **Earlier A8 QA receipt (historical, not current-SHA QA):** single guarded task `pockethost-a8-dashboard-manifest-release-4716-20261115-v1` returned terminal `done`, exit 0, inner `PocketHostFastFlow PASS`, `deployment=applied`, `tests=PASS`, and **20 scoped QA checks** (source syntax, TypeScript, structure/boundaries, Node, UI, docs, lint, Markdown and format). Exact running SHA confirmed.
- **Delivered:** adaptive Basic/Enhanced dashboard; sparse telemetry history acceptance; optional battery/sysfs fallback; dependency manifest, pinned npm QA packages and Termux-safe direct-Node tools; safe runit worker and UI regression fixes. **Not yet accepted:** whole Services S1–S4, Python execution gate, true device reboot/autostart, production readiness or optional Companion/Shizuku installation. Current GitHub `main` may move forward via docs-only commits, which do not restart DEV.
- The previous, detailed 2026-11-14/15 A8 implementation receipts and design decisions are preserved in Git at `c09b4dc:docs/HANDOFF_NEXT_CHAT.md`. Older evidence remains in [checkpoint archive](checkpoints/README.md). Do not preload archival documents into every task.

## Current autonomous sprint — 2026-11-16

- S1–S4 fixed-template worker physical lifecycle: `pockethost-a8-s1-s4-complete-owned-flow-396058d2-20261116-v1` PASS, including create/start/health/logs/recovery-review/stop/archive/restore/retire; worker retired and retained privately.
- Platform status and independent LAN readback: `pockethost-a8-platform-git-overview-fast-flow-20261116-v1` PASS. Git origin is classified without exposing credentials or remote names. Actual remote auth/SSH policy and reboot unverified.
- Hosting static exact-release readback: `pockethost-a8-hosting-static-exact-readback-fast-flow-20261116-v1` PASS (deployment safety only). Hosted-site end-to-end workflow not physically accepted.
- Hosting exact-create readback: `pockethost-a8-hosting-create-exact-readback-fast-flow-20261116-v1` PASS, live `2fb4c425`. Live release content gate and marker rollback on failed publish/restore/rollback: `pockethost-a8-hosting-release-content-gate-fast-flow-20261116-v1` PASS, live `eff74e52b0c73b0a43c3c1fd96244f8fbe3d2819`, PID 27589. Both are guarded deployment receipts only: no live hosted-site acceptance or current-source QA.
- Restic UI scope snapshot/readback: `pockethost-a8-stabilization-restic-readback-fast-flow-20261116-v1` PASS. Real Backup/Restore not executed. Live SHA `64c92f3b825df015095bea041fbb529ed1e7d7fb`, PID 25555, HTTP 200, protected unchanged.
- Current-SHA QA / lint / typecheck / smoke **NOT RUN**. Prior scoped 7/7 on `c0bf0218` remains historical. No stage accepted. Pending: generic service enrollment and custom execution authorization, reboot/Boot test, SSH/GitHub configuration, Hosting physical deploy/rollback and isolated backup restore with explicit approvals.

## Product and safety

- Services menu: dedicated Overview, Runit, Autostart, Hosting workloads, Health, Local Agent, Cloudflare, SSH and MQTT. No hardcoded hosted app catalog. `/services` is links-only; no foreign service is adopted from observation.
- Runtime ownership is checked against exact verified registry, run script, marker and canonical target. The LAN page may manage only attested standalone fixed workers; Node project units remain delegated to Node Hosting. Third-party runit services, PocketHost panel/watch and independent Local Agent remain protected.
- Python source (max 32 KiB) can be staged, reviewed, versioned and restored with SHA-256 in stopped/down state. **Arbitrary Python execution, start, restart, autostart and recovery from unauthenticated LAN remain blocked.** No user script was executed.
- Dashboard mode is adaptive: Termux basic readings always available where sources permit; Companion/Shizuku Android CPU and traffic appear only with fresh authorized evidence. Missing optional Android data is expected, not a global monitoring failure.
- QA depends on committed root and admin `package-lock.json` plus [dependency manifest](../scripts/dev/termux-dependency-manifest.mjs). A8 QA has local dependencies restored. Tool binaries use direct Node because Android Termux lacks `/usr/bin/env`. No global installs, lifecycle scripts or network exposure.
- Trusted LAN is passwordless DEV only; no WAN exposure. No changes to S22 production IleStoi/PhotoMap, SSH, Cloudflare, MQTT, unrelated runit or Local Agent services. Any physical reboot or protected-service mutation requires separate explicit authorization.

## 2026-11-16 S4 correction and QA evidence

- **Historical failure (resolved by code fix):** the first `9bf224dc1b47fe9cd94be733690bb4bc137a9227` guarded release returned HOLD after panel readiness could not recover; rollback PASS, and independent readback confirmed the prior live `ceb7f07b96b15f41fd42f91b80a0e9a7364b573e`, HTTP 200 and protected services untouched.
- **Explicit owner-authorized one-time QA on `9bf224dc1b47fe9cd94be733690bb4bc137a9227`:** task `pockethost-a8-s4-approved-qa-9bf224dc-20261116-v1`, approved categories `format,structure,boundaries,root-types,admin-types,node,ui`. `syntax` had no planned standalone command for the changed TypeScript sources. Result **FAIL** at changed-file format: parser reported `SyntaxError: ';' expected` in `src/modules/host/worker-loopback-readiness.ts` line 23; format warnings in `src/modules/host/termux-service-admin.ts` and `docs/LOCAL_AGENT_TERMUX.md`. Structure PASS; boundaries PASS; root/admin typechecks and six Node/five UI tests **SKIPPED** by the quality gate after the cheap failure. No service mutation or deployment by QA.
- **Last corrections:** `a4644165` fixed the TypeScript arrow returning an object and aligned the helper source; `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6` aligned the HTTP method formatting and removed extra Markdown blank space.
- **Corrected version released:** A8 `pockethost-a8-http-readiness-syntax-fixed-20261116-v1` PASS, live `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6`, PID 2106, start ticks 23573375, HTTP 200, protected unchanged. The new HTTP readiness sends one bounded GET only to a verified worker-owned `127.0.0.1` listener with process/PID continuity checks. No generic URL, stored schedule, automatic retry or arbitrary source execution.
- **Owner-approved one-shot QA of deployed bfd16d6362b879a41120389fe2d2e81a1a6cd8e6:** immutable A8 task `pockethost-a8-s4-approved-qa-bfd16d63-20261116-v1` used comparison ancestor `ceb7f07b96b15f41fd42f91b80a0e9a7364b573e`, exact head `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6`, categories `format,structure,boundaries,root-types,admin-types,node,ui`. Terminal outer `failed`, exit 1, inner `QA_FAIL`; changed-file format **FAIL** (Prettier warnings in `src/modules/host/termux-service-admin.ts` and `src/modules/host/worker-loopback-readiness.ts`), structure PASS, boundaries PASS; root/admin typechecks, Node tests, and UI tests **SKIPPED** by the cheap-failure gate. No deployment, service mutation, retry or rerun. The earlier TypeScript syntax parser error was not reported in this QA.
- **Historical repair plan (completed later):** at the time of the failed QA on `bfd16d63`, source formatting, targeted typecheck correction and updated UI test fixture were still pending. These were subsequently completed and verified by the final 7/7 PASS receipt below. The live version is now `47fdfd428ccf7911a7f9a71f7c63c76edfdee5b3`.

## Historical takeover readback and exact-SHA QA baseline (2026-11-16)

- A new one-off **read-only** A8 task `pockethost-a8-takeover-readback-20261116-v1` returned terminal `done`, command exit 0, inner `READBACK`: live `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6`, PID 2106/start ticks 23573375, markers matching, same-UID `/proc` start verified, PocketHost panel/watch and Local Agent running, HTTP 200, `sshd` and `ssh-agent` down. `tests=not-run`, `deployment=none`, no service mutations. This is operational health, not application/QA acceptance.
- **Avoid an empty post-deploy QA range:** for the S4 HTTP readiness change, the comparison ancestor is `ceb7f07b96b15f41fd42f91b80a0e9a7364b573e` and the exact target is `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6`. An A8 QA checkout pinned cleanly at the exact target must use `--base=ceb7f07b96b15f41fd42f91b80a0e9a7364b573e`; using current live SHA as both base and target yields `NO_CHANGES` and is **not** QA evidence. GitHub `main` has subsequently moved through documentation-only commits; do not silently test that HEAD instead.
- **Historical consent used:** QA of `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6` was authorized and executed once, resulting in `QA_FAIL` (format). The separate subsequent approvals and final successful QA receipt are documented below.

## 2026-11-16 final QA and A8 handoff receipt

- **Live A8 source:** `47fdfd428ccf7911a7f9a71f7c63c76edfdee5b3`; guarded release `pockethost-a8-readiness-inode-guard-fast-flow-20261116-v1` PASS. Final readback `pockethost-a8-s4-final-readback-20261116-v1` returned done/exit 0/READBACK: PID 30493, start ticks 24510709, source/owner/gateway markers agree, /proc start attested, HTTP 200, panel/watch/Local Agent running, SSH/ssh-agent down, no service mutations.
- **Final scoped QA:** `pockethost-a8-s4-final-qa-c0bf0218-20261116-v1` on source `c0bf02184c804d93fca7a50cddbdd9b1146ee2c8` returned outer done/exit 0, inner QA_PASS. All seven approved checks passed: changed-file format, structure, boundaries, root incremental typecheck, admin incremental typecheck, Node tests and UI tests. Compare ancestor `ceb7f07b96b15f41fd42f91b80a0e9a7364b573e`.
- **Why two SHAs:** after deploying code `47fdfd428ccf7911a7f9a71f7c63c76edfdee5b3`, the UI enrollment test fixture was updated to match the strict creation receipt, attested registry `identityReason` and verified runit state message. It changes tests only; runtime stays `47fdfd428ccf7911a7f9a71f7c63c76edfdee5b3`. QA target `c0bf02184c804d93fca7a50cddbdd9b1146ee2c8` is not claimed to be deployed.
- **Resolved during this continuation:** source Prettier warnings; Markdown handoff formatting; TS narrowing for /proc socket inode `fields[9]`; stale UI fixture. Earlier FAIL/HOLD receipts below are history. No reboot, WAN, SSH, foreign service mutation, production activation or scheduler.
- **Not accepted:** full Services S1–S4 lifecycle/worker physical flows; Termux:Boot after real reboot; custom code activation, broad application-level HTTP readiness; Platform, Hosting, stabilization and product acceptance. Current position is safe handoff after a scoped S4 QA gate, **not** overall MVP acceptance.

## Next action

1. Resume canonical **S1 generic verified service enrollment**, then S2 lifecycle/logs, S3 autostart and S4 health per [MVP plan](MVP_EXECUTION_PLAN.md); do not mistake the scoped S4 QA PASS for complete Services acceptance.
2. Fresh main and private A8 live-SHA/owner readback before the next one-pass code → deploy → verify. Default tests OFF; each new exact-SHA QA scope needs separate owner confirmation. No automatic retries or duplicate agent tasks.
3. Maintain strict process/provenance gates; no S22, SSH, WAN, reboot, arbitrary user-code start, foreign services or schedulers without separate permission.

**Stages S1–S4 remain IN_PROGRESS; S5 scoped QA PASS is not full Services or MVP acceptance.**
