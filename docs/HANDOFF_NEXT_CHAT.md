---
status: active
owner: core
last_reviewed: 2026-11-15
purpose: A8 development handoff with exact live SHA and QA release gate
---

# PocketHost — Galaxy A8 handoff

## Current verified state

- **Device:** paired Samsung Galaxy A8, official Termux, PocketHost-owned DEV only. Never use Mac, S22, Codex, Work, GitHub Actions or schedulers for this flow.
- **Last verified live source:** `a8287588bac3e631e36549fa7000427a6c3142eb` (2026-11-15). Exact owner/PID/start-ticks checks and loopback HTTP 200 passed; protected foreign services unchanged. Panel opened on MacBook via trusted private LAN. The full device reboot/Termux:Boot path is not qualified.
- **Latest candidate:** read fresh GitHub `main` HEAD; source may be ahead of live. The adaptive Basic/Enhanced Dashboard, updated sparse telemetry schema and battery fallback, QA manifest, and Termux-safe direct Node CLI gates are committed but **not yet deployed**.
- **Active release blocker:** scoped A8 QA `--tests` stopped at the documentation gate after Node and UI regression passes. Previous A8 task `pockethost-a8-dashboard-manifest-qa-c09b-20261115-v1` returned HOLD, `deployment=not-started`, `protectedServices=not-modified`. Documentation errors: `HANDOFF_NEXT_CHAT.md` exceeded 6144 bytes and `MVP_EXECUTION_PLAN.md` lacked docs index entry. This concise handoff plus index entry address those errors; **rerun the real gate and verify its result before any deployment**.
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
