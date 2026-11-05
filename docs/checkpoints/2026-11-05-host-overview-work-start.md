---
status: accepted
owner: host
last_reviewed: 2026-11-05
purpose: Record native Termux read-only Host overview acceptance and exact limitations
---

# Host Overview P1 — native acceptance checkpoint

## Published source and scope

`feat/host-overview-v1` at code commit `8c1e59d402ac4c10049af0cd53244f26cba396ab`. The original 32 ShadcnStore Vite demo routes, assets, and MIT license were retained. One additional `/host` route and sidebar entry were added. Existing externally owned Termux services remain inspection-only. UI preview runs manually on **127.0.0.1:8787**, never public.

The host adapter uses an explicit five-service `sv status` allowlist, error normalization to `running / stopped / unknown`, and sanitized runtime metadata. No PIDs, command-line arguments, environment variables, config contents, or write operations are returned by the API. This is DEV-only, not a production administrative server.

## Native test evidence

All development commands ran in the **real Android Termux environment via installed Local Agent**, inside a separate `~/Projects/PocketHost-P1` worktree, without building on Mac, GitHub Actions, Codex or Work.

- `pockethost-p1-host-overview-native-gates-20261105-v1`: `npm run check:foundation` PASS **18/18 tests**, 435 npm dependencies installed, `npm run build` PASS. `npm run lint` initially failed on React `set-state-in-effect`; no exception to lint was allowed.
- `pockethost-p1-host-overview-lint-fix-native-20261105-v2`: fixed effect, **18/18 tests PASS**, **ESLint PASS**, **Vite build PASS**, and clean worktree, exact source commit `8c1e59d...`.
- `pockethost-p1-live-host-overview-acceptance-20261105-v1`: guarded on-phone preview switch from an **ownership-verified PocketHost Vite process**, rollback provisioned. All acceptance checks PASS: existing `/dashboard` HTTP **200**, new `/host` HTTP **200**, snapshot GET **200**, POST **405**, foreign Origin **403**, forged Host **403**, five sanitized externally owned services; `IleStoi.pl` observed **running** in both API and independent fixed `sv status` check. Result `done/exit 0`; new PocketHost preview PID `7419`. Do not interpret a positive `sv status` alone as full application functional acceptance.

## Remaining boundaries

- The user confirmed that the panel **looks good**, not detailed 32-screen navigation, screen-reader accessibility, pinch/zoom, or screenshot-diff acceptance.
- No service control, install, DNS modification, public ingress, APK, authentication or AI features exist. **Do not expose this DEV API over the network.**
- Full root `npm run check` Gate 1 and automatic Android GUI test harness have not been accepted.
- Termux Local Agent's separate `runsvdir` lifetime/autorestart needs its own dedicated evidence-backed fix; do not modify IleStoi.pl's working boot configuration.
- The next sprint may enrich diagnostics with **fixed, bounded, read-only** probes and preserve the existing screen layout.

## Safe handoff

Use current HEAD when resuming; do not assume this checkpoint's SHA remains latest. All development execution remains on physical Termux through the exact Local Agent host-command lane. No project binding required. Never start another port-8787 server without an ownership-verified switch/rollback.
