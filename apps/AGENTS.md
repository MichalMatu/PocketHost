# Admin Application Instructions

## Scope

All applications under `apps/`, initially the full, pinned ShadcnStore Vite dashboard imported into `apps/admin`. Preserve all upstream routes and component assets as requested. Feature adaptation follows later.

## Forbidden

No automatic device boot or Termux autostart. No host command execution from the UI. Do not integrate production IleStoi.pl or modify Local Agent. Never allow Vite to listen on a public interface: bind to 127.0.0.1 with a strict dedicated port. Do not disable Android pinch zoom.

## Gate

Read `../docs/DESIGN_SYSTEM.md` and `../docs/ADMIN_MVP.md`. Use Local Agent on Termux for imports, package installation, builds and launch. Preserve the upstream MIT license and pin its exact source SHA. Verify all routes were preserved. Root and app-specific quality gates are separate and both required for acceptance.
