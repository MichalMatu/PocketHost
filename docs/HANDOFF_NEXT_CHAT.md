---
status: active
owner: core
last_reviewed: 2026-11-15
purpose: A8 development handoff with exact live SHA and QA release gate
---

# PocketHost — Galaxy A8 handoff

## Current verified state

- **Device:** paired Samsung Galaxy A8, official Termux, PocketHost-owned DEV only. Never use Mac, S22, Codex, Work, GitHub Actions or schedulers for this flow.
- **Last verified live source:** `4716e7f21fde1bea019bc87e52015030415ba181` (2026-11-15), PID **29198**, start ticks **18333015**, HTTP **200**, 15.78 GiB free. Termux owner/readback and protected-service isolation verified; independent processes remain untouched. Termux:Boot has not been reboot-tested.
- **A8 release PASS:** single guarded task `pockethost-a8-dashboard-manifest-release-4716-20261115-v1` returned terminal `done`, exit 0, inner `PocketHostFastFlow PASS`, `deployment=applied`, `tests=PASS`, and **20 scoped QA checks** (source syntax, TypeScript, structure/boundaries, Node, UI, docs, lint, Markdown and format). Exact running SHA confirmed.
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

1. Use fresh `main` and compare against verified live SHA. Run **one** guarded Samsung A8 Local Agent FAST FLOW task with the already owner-authorized scoped `--tests` gate.
2. If tests fail, read the exact JSON QA receipt and fix the real contract. Never bypass unknown/high-risk checks or run duplicate jobs.
3. Only on PASS: guarded DEV-only panel switch, read exact live SHA/PID/start ticks, HTTP health, private-LAN access and protected-service isolation; share [MVP plan](MVP_EXECUTION_PLAN.md) stage status for user acceptance.

**Stages S1–S4 remain IN_PROGRESS; full S5 acceptance is not complete.** A successful build or HTTP 200 alone is not product acceptance.
