---
status: active
owner: core
last_reviewed: 2026-11-15
purpose: A8 development handoff with exact live SHA and QA release gate
---

# PocketHost — Galaxy A8 handoff

## Current verified state

- **Device:** paired Samsung Galaxy A8, official Termux, PocketHost-owned DEV only. Never use Mac, S22, Codex, Work, GitHub Actions or schedulers for this flow.
- **Last verified live source:** `fa43b0c549f82353393cd80f6e314ce84d2e0e7c` (2026-11-15), PID **4475**, start ticks **19351091**, HTTP **200**, 15.76 GiB free, protected services unchanged, `tests=not-run`. FAST FLOW took **10.228 s** on A8; task `pockethost-a8-service-boot-inspection-20261115-v1` returned terminal PASS. The Autostart page now reads local Termux:Boot script metadata without reading/executing scripts or assuming Android permissions/reboot success; no functional QA and no phone reboot.
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

## Next action

1. **Global tests OFF — prior stage QA consent revoked.** On next code iteration, use fresh `main` and exact live SHA, then publish one guarded A8 FAST FLOW task **without** any test flag. Never run tests, lint, formatting, typecheck or smoke on your own.
2. If owner wants tests, ask for a fresh, explicit one-run scope and exact SHA. Only then use the independent `verify-changed.mjs --execute --approved-head=<SHA> --approved-checks=<explicit-categories>` on A8 (only categories agreed for that exact revision). Never bundle testing with deployment.
3. On guarded deployment PASS, read exact SHA/PID/start ticks, basic HTTP and protected services; share [MVP plan](MVP_EXECUTION_PLAN.md) stage status. Failed ownership or unknown receipt means HOLD, not retry.

**Stages S1–S4 remain IN_PROGRESS; full S5 acceptance is not complete.** A successful build or HTTP 200 alone is not product acceptance.
