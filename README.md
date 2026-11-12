# PocketHost

PocketHost is a **Termux-hosted web control panel and hosting
platform for an Android phone**. Current development prioritizes a
fully functional **Basic** product using only official Termux and its
supported packages: Node.js applications, GitHub deployments,
Cloudflare/domain publishing, SSH, per-project web traffic analytics,
files, terminal and backup. Hosting is the primary product focus;
the current menu is not being reorganized during this sprint.

**Basic/Pro is a technical separation, not a free/paid tier:**
Basic never requires Companion/Shizuku or another Android helper
app. Pro adds Android-app-dependent capabilities; its existing
Companion/Shizuku source is preserved but frozen. The future
single-APK integration is deferred. Both scopes are intended to
be fully functional, and planned integrations are not claims that
they are already deployed.

**Next two work packages:** (1) finish Node.js Hosting with
GitHub import/update and safe rollback; (2) complete the panel's
Cloudflare, SSH, per-site analytics and backup workflows. A versioned
bundle and one-command Termux installer follow the working end-to-end
Hosting flow. See [canonical roadmap](docs/ROADMAP.md).

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
- [Deferred future single-APK architecture](docs/adr/0017-termux-first-single-app-integration.md)
- [Roadmap](docs/ROADMAP.md)
- [Quality gates](docs/QUALITY_GATES.md)
- [Documentation index and historical evidence](docs/README.md)

All PocketHost source commands, tests, builds and installs run only
on the verified Samsung Termux via Local Agent. Source updates use
fresh main and non-force commits. Normal UI changes use affected
tests and Vite HMR; whole gates are for meaningful milestones
or risky host changes. Do not restart unrelated services just to
advance development.
