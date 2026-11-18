---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-19
purpose: Typed module ownership
---

# Module boundaries

Host exclusively owns OS and process effects; all other modules use typed contracts. Modules, externally observed services, explicitly managed services and Hosting projects remain distinct. See [architecture](ARCHITECTURE.md).

## Map and limitations

- Browser views and bounded API parsers: `apps/admin/src/app` and `apps/admin/src/lib`.
- Portable typed contracts: `src/shared`; no host-only imports.
- Termux process/filesystem/runit effects: `src/modules/host` and the guarded
  server-side API bridge in `apps/admin/plugins`; never import these in browser UI.
- Static sites and trusted Node projects have separate identity, process and
  release roots; observed external services never become owned automatically.

`check-boundaries.mjs` and `check-code-budgets.mjs` cover only documented
static rules and pinned legacy size limits, not the entire runtime dependency
or ownership graph. Large pinned files remain modularity debt. Split only
with a concrete behavior-preserving reason and exact-SHA owner-approved QA.
See [code map](CODE_MAP.md) and [quality gates](QUALITY_GATES.md).
