---
status: active
owner: core
last_reviewed: 2026-11-09
purpose: Small PocketHost context entrypoint; detailed evidence is linked, not preloaded
---

# PocketHost — Minimal Context

## State and authoritative sources

- Work only from **fresh MichalMatu/PocketHost main**; handoff SHAs are
  historical evidence, never the assumed HEAD.
- DEV-only Samsung Termux admin panel; Shizuku and direct owner-triggered
  power-user actions are product scope. Preserve all unrelated services,
  PocketHost-only runit exception, private LAN and ownership checks.
- M0/M1 implementation and focused Samsung evidence exist, but final
  exact-SHA G1/G2 and physical G3 are **OPEN**, not assumed PASS.
  See [current QA record](QUALITY_GATES.md) and
  [latest M0/M1 checkpoint](checkpoints/2026-11-09-m0-m1-ownership-and-canonical-style.md).
- For historical receipt IDs or a blocked milestone, open the
  [extended handoff](HANDOFF_NEXT_CHAT.md) **only at the relevant section**.
  Previous PASS does not validate a newer code SHA.

## Smallest work loop

1. Read root AGENTS.md and nearest scoped AGENTS.md, fresh HEAD and
   changed paths; read additional docs **on demand**.
2. Compare against the last verified SHA, preview with
   `npm run dev:changed -- --base=<sha>`; run that plan only through
   the verified Samsung Termux Local Agent after checking pending tasks.
3. Run impacted tests, incremental typecheck where applicable and
   changed-file lint/format; preserve existing npm, Vite and TypeScript
   caches. No automatic reinstall, whole build or duplicated QA.
4. For UI changes use existing Vite HMR. Restart only the positively
   owned PocketHost panel if necessary; backend changes require manual
   sync/review. No foreign service operations.
5. Record exact SHA, terminal receipt, checks executed/skipped and
   remaining manual review; no claims of device PASS without receipt.

## Where to look next

- [Code and tests map](CODE_MAP.md)
- [Fast checks, caching and DEV sync](DEV_ITERATION.md)
- [Exact Local Agent transport, host verification](LOCAL_AGENT_TERMUX.md)
- [Architecture/module boundaries](ARCHITECTURE.md)
- [Quality and release acceptance](QUALITY_GATES.md)
- [Product roadmap](ROADMAP.md)
- [Document index](README.md) and [historical archive](checkpoints/README.md)

Keep this entrypoint short. Archive evidence in existing checkpoints, not
by prepending another full status transcript here.
