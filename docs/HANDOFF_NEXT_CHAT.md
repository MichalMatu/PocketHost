---
status: active
owner: core
last_reviewed: 2026-11-15
purpose: A8 development handoff with exact live SHA and QA release gate
---

# PocketHost — Galaxy A8 handoff

## Current verified state

- **Device:** paired Samsung Galaxy A8, official Termux, PocketHost-owned DEV only. Never use Mac, S22, Codex, Work, GitHub Actions or schedulers for this flow.
- **Last verified live source:** `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6` (2026-11-16), PID **2106**, start ticks **23573375**, HTTP **200**, 15.8 GiB free, protected services verified unchanged, `tests=not-run`. Guarded A8 FAST FLOW task `pockethost-a8-http-readiness-syntax-fixed-20261116-v1` returned terminal **PASS**, release **10.556 s**, total **14.502 s**. S4 manual same-PID loopback HTTP probe is now deployed. Its behavior is **not yet functionally QA-verified**; readiness results require a positively attested loopback socket. No scheduler, automatic recovery, reboot, or protected-service change.
- **Earlier A8 QA receipt (historical, not current-SHA QA):** single guarded task `pockethost-a8-dashboard-manifest-release-4716-20261115-v1` returned terminal `done`, exit 0, inner `PocketHostFastFlow PASS`, `deployment=applied`, `tests=PASS`, and **20 scoped QA checks** (source syntax, TypeScript, structure/boundaries, Node, UI, docs, lint, Markdown and format). Exact running SHA confirmed.
- **Delivered:** adaptive Basic/Enhanced dashboard; sparse telemetry history acceptance; optional battery/sysfs fallback; dependency manifest, pinned npm QA packages and Termux-safe direct-Node tools; safe runit worker and UI regression fixes. **Not yet accepted:** whole Services S1–S4, Python execution gate, true device reboot/autostart, production readiness or optional Companion/Shizuku installation. Current GitHub `main` may move forward via docs-only commits, which do not restart DEV.
- The previous, detailed 2026-11-14/15 A8 implementation receipts and design decisions are preserved in Git at `c09b4dc:docs/HANDOFF_NEXT_CHAT.md`. Older evidence remains in [checkpoint archive](checkpoints/README.md). Do not preload archival documents into every task.

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
- **Next bounded repair:** format only the two warned source files, but no new Prettier run (including `--write`), lint, typecheck or QA without fresh explicit approval. Then commit reviewed changes, apply only through one guarded A8 FAST FLOW without tests, and request separate exact-SHA QA consent for a new revision. Keep current live `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6` until a guarded PASS; do not declare Services S1–S4 accepted.


## Takeover readback and exact-SHA QA baseline (2026-11-16)

- A new one-off **read-only** A8 task `pockethost-a8-takeover-readback-20261116-v1` returned terminal `done`, command exit 0, inner `READBACK`: live `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6`, PID 2106/start ticks 23573375, markers matching, same-UID `/proc` start verified, PocketHost panel/watch and Local Agent running, HTTP 200, `sshd` and `ssh-agent` down. `tests=not-run`, `deployment=none`, no service mutations. This is operational health, not application/QA acceptance.
- **Avoid an empty post-deploy QA range:** for the S4 HTTP readiness change, the comparison ancestor is `ceb7f07b96b15f41fd42f91b80a0e9a7364b573e` and the exact target is `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6`. An A8 QA checkout pinned cleanly at the exact target must use `--base=ceb7f07b96b15f41fd42f91b80a0e9a7364b573e`; using current live SHA as both base and target yields `NO_CHANGES` and is **not** QA evidence. GitHub `main` has subsequently moved through documentation-only commits; do not silently test that HEAD instead.
- **Consent used:** QA of `bfd16d6362b879a41120389fe2d2e81a1a6cd8e6` was authorized and executed once, resulting in `QA_FAIL` (format). No further test or format execution is covered by that authorization.

## Next action

1. **Global tests OFF — prior stage QA consent revoked.** On next code iteration, use fresh `main` and exact live SHA, then publish one guarded A8 FAST FLOW task **without** any test flag. Never run tests, lint, formatting, typecheck or smoke on your own.
2. If owner wants tests, ask for a fresh, explicit one-run scope and exact SHA. Only then use the independent `verify-changed.mjs --execute --approved-head=<SHA> --approved-checks=<explicit-categories>` on A8 (only categories agreed for that exact revision). Never bundle testing with deployment.
3. On guarded deployment PASS, read exact SHA/PID/start ticks, basic HTTP and protected services; share [MVP plan](MVP_EXECUTION_PLAN.md) stage status. Failed ownership or unknown receipt means HOLD, not retry.

**Stages S1–S4 remain IN_PROGRESS; full S5 acceptance is not complete.** A successful build or HTTP 200 alone is not product acceptance.
