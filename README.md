# PocketHost

PocketHost is an experimental Android/Termux hosting control panel. P0–P2 provide a native-tested read-only host monitor and React administration dashboard. P3 adds a **manually launched PocketHost-owned static demo** with scoped Start/Stop, sample publication, single-step rollback and an opt-in private-LAN gateway. P4 introduces the first **real imported project, PhotoMap TEST**, as a private, stopped managed-data catalog. P4 is not a full managed application runtime yet.

## Current development status

| Milestone | Scope | Status |
| --- | --- | --- |
| P0–P2 | Foundation, native monitoring and dashboard | Native device accepted |
| P3 | Explicitly owned static demo and private-LAN gateway | Device/browser viewing accepted; final P3 control/browser gates and feature-branch release still tracked |
| P4 | Private PhotoMap snapshot, registry, versions and safe read-only catalog | Data import accepted; panel/source candidate pending final same-SHA quality and guarded deployment |
| Next | Isolated Debian PRoot, verified PhotoMap lifecycle, snapshots and rollback | Not implemented |

PhotoMap original checkout, including local changes, was preserved. Its verified stopped import contains copied SQLite and **2,196 media files**. PhotoMap runtime is explicitly disabled: no autostart, package updates or full rollback. Existing IleStoi.pl, Raspberry Pi production PhotoMap, Cloudflare and Local Agent are out of scope.

## Strict development rules

- **Only GitHub Connector + the exact Samsung Termux Local Agent** for PocketHost source/development commands. No Codex, ChatGPT Work, GitHub Actions, Mac/Linux execution, new branches or force push without separate authorization.
- Never infer ownership from process names or ports. No control or modification of externally managed services.
- Panel development runs manually from CLI, loopback only by default. Trusted-home-LAN gateway requires an explicit opt-in, exact private interface and security gates; it is not public authentication.
- Project package updates, system-wide package operations, autostart and public deployment remain disabled until separately authorized and tested.

## Where to resume

Read [next-chat handoff](docs/HANDOFF_NEXT_CHAT.md), [latest P4 checkpoint](docs/checkpoints/2026-11-06-p4-managed-photomap-catalog.md), [PhotoMap import closeout](docs/checkpoints/2026-11-06-photomap-runit-autorestart-regression.md), [architecture](docs/ARCHITECTURE.md), [quality gates](docs/QUALITY_GATES.md) and [Local Agent runbook](docs/LOCAL_AGENT_TERMUX.md). Read [AGENTS.md](AGENTS.md) before any operations. The current development branch is `sprint/p3-mvp-integration-20261105`; verify its actual HEAD and `main` anew before work.

For code changes, run `npm run check`, `npm run admin:lint`, `npm run admin:build` and `npm --prefix apps/admin run test:ui` **on Samsung Termux via Local Agent only**, then obtain terminal task results and independent physical checks before declaring acceptance.
