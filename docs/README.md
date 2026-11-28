# PocketHost documentation

The current tree holds **maintained reference documents** only. Long-running sprint transcripts, retired ADR stubs and old checkpoints remain in [unchanged Git history](https://github.com/MichalMatu/PocketHost/tree/d2bacd081ad0879d49a08e3c7fd97789185ad6e4/docs); do not treat historical SHA snapshots as the live A8 state.

## Start and operate

- [Clean installation on Termux](INSTALLATION.md).

- [Start here](START_HERE.md), [current handoff](HANDOFF_NEXT_CHAT.md), [MVP acceptance](MVP_EXECUTION_PLAN.md), [quality gates](QUALITY_GATES.md).
- [Architecture](ARCHITECTURE.md), [code map](CODE_MAP.md), [module separation](MODULES.md).
- [A8 Local Agent](LOCAL_AGENT_TERMUX.md), [guarded development](DEV_ITERATION.md), [documentation rules](AGENTS.md).

## Detailed references

- [Node Hosting](NODE_HOSTING_LAN_MVP.md), [runit services](S1_RUNIT_REUSE.md), [historical MVP integration and Restic evidence](MVP_INTEGRATION_CHECKLIST.md).
- [Test Lab](TEST_LAB.md), [off-device recovery design](P1_OFF_DEVICE_RESTIC_PLAN.md), [shared tunnel proposal](CLOUDFLARE_SHARED_TUNNEL_MVP.md).
- [Navigation and screen map](NAVIGATION_MAP.md), [visual composition standard](VISUAL_COMPOSITION_STANDARD.md).
- [Roadmap](ROADMAP.md), [UX execution plan](UX_EXECUTION_PLAN.md), [deferred feature sprints](DEFERRED_FEATURE_SPRINTS.md), [Cloudflare roadmap](CLOUDFLARE_ROADMAP.md), [upstream reuse strategy](UPSTREAM_REUSE_STRATEGY.md).

## Implemented module documents

- [`config`](modules/config.md)
- [`host`](modules/host.md)
- [`observability`](modules/observability.md)
- [`packages`](modules/packages.md)
- [`runtime`](modules/runtime.md)
- [`sites`](modules/sites.md)

Former documentation-only module scopes are recorded in [module ownership](MODULES.md).

## Historical evidence

[Retained evidence index](checkpoints/README.md) and the [pre-cleanup documentation snapshot](https://github.com/MichalMatu/PocketHost/tree/d2bacd081ad0879d49a08e3c7fd97789185ad6e4/docs). Preserve immutable Git commit history; do not squash the release audit trail.
