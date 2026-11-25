---
status: proposed
owner: core
last_reviewed: 2026-11-25
purpose: Safe selective comparison of TermuxPanel for a future sprint
---

# Upstream reuse — selective, not a merge

Candidate: [Himalay Ladha's TermuxPanel](https://github.com/himalayladha/termux-hosting-panel) (public `main`, MIT license; copyright © 2026 Himalay Ladha). Its Node/Express backend, vanilla-JS frontend and Termux installer differ substantially from PocketHost's typed React/Vite admin and independently owned runit-hosted services.

| Priority | Candidate to study                                 | PocketHost adoption condition                                                                           |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1        | Lightweight site analytics and uptime presentation | Reuse ideas, not the upstream recurring restart watchdog; on-demand observation and bounded reads first |
| 2        | File manager and website starter templates         | Only fill measured gaps in existing Static/Node workflows; retain path and ownership validation         |
| 3        | Database inspection UX                             | Read-only isolated project scope first; no unrestricted SQL runner over host databases                  |
| 4        | Python/PHP runtime adapters                        | Separate future capability with resource, process ownership and isolation review                        |
| Later    | Domain/tunnel or notification management           | Explicit LAN/WAN boundary, existing Pi origin, credentials and owner consent                            |

**Do not transplant wholesale:** upstream process supervision, cron/watchdog recovery, shell-built backup commands, remote tunnel automation, raw terminal server or database controls. PocketHost already uses runit and an independent Local Agent; competing supervisors or automatic public exposure would regress its invariants.

The upstream [MIT license](https://github.com/himalayladha/termux-hosting-panel/blob/main/LICENSE) permits reuse subject to preserving its copyright and license notice in copies or substantial portions. No upstream code is imported by Sprint 5. Evaluate each selected component's version, limitations, tests, licensing and safety before any production merge.

## Sprint 5 review outcome

Reviewed upstream source at `0d6ce220885694e62707c9efd37a7af11afc3154` under MIT. The upstream analytics uses a global RPS approach, per-request SQL writes and estimated active-user metrics. PocketHost instead implements independent per-project completed-response aggregates, bounded hourly snapshots, coalesced writes and on-demand read-only views. No source copied, no Express migration, extra supervisor or dependency. Measured A8 overhead and acceptance are recorded in [quality gates](QUALITY_GATES.md). Later upstream topics remain unevaluated for implementation.

Historical upstream notes remain in [Git history](https://github.com/MichalMatu/PocketHost/tree/d2bacd081ad0879d49a08e3c7fd97789185ad6e4/docs/UPSTREAM_REUSE_STRATEGY.md).
