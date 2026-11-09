# PocketHost

PocketHost is an experimental **Android Termux management console**
with an owner-operated React/Vite DEV panel, system/host diagnostics,
owned static Hosting, Termux administration and Android Shizuku
integration. The longer-term target is a **modular platform** where
Hosting composes reusable Node, Python, SSH, Cloudflare and other
capabilities. Planned modules are not claims of deployed features.

## Current scope and safety

The current private-LAN DEV panel is **not authenticated public
administration**; never expose it on WAN. A direct owner-requested
Shizuku Advanced Shell action uses actual Android permissions —
ADB is not root. The sole owner-approved runit/watchdog autostart
exception is for the **existing PocketHost DEV panel**. External
Termux services, IleStoi, PhotoMap, Local Agent and hosted sites
remain independent; discovery does not grant lifecycle ownership.

Historical source/device tests do not certify the latest main.
Current-SHA G1/G2 and physical G3 can remain OPEN even when an older
revision passed. Source work and panel deployment are separate.

## Development entrypoints

- [Minimal context and present status](docs/START_HERE.md)
- [Instructions for agents](AGENTS.md)
- [Code map and affected tests](docs/CODE_MAP.md)
- [Fast flow and cache-aware checks](docs/DEV_ITERATION.md)
- [Samsung Termux Local Agent execution](docs/LOCAL_AGENT_TERMUX.md)
- [Roadmap](docs/ROADMAP.md)
- [Quality gates](docs/QUALITY_GATES.md)
- [Documentation index and historical evidence](docs/README.md)

All PocketHost source commands, tests, builds and installs run only
on the verified Samsung Termux via Local Agent. Source updates use
fresh main and non-force commits. Normal UI changes use affected
tests and Vite HMR; whole gates are for meaningful milestones
or risky host changes. Do not restart unrelated services just to
advance development.
