---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-22
purpose: Actual module ownership, implementation coverage and separation limitations
---

# Module ownership and separation

**Boundary:** `apps/admin/src` is browser UI and API clients; `apps/admin/vite.config.ts` and `apps/admin/plugins` are Node-side API bridges; `src/shared` contains portable contracts; `src/modules/host` owns Termux filesystem/process/runit side effects. Other registered modules provide pure policy, validation and projections. Discovery never implies ownership. See [architecture](ARCHITECTURE.md) and [code map](CODE_MAP.md).

The `project.structure.json` registry includes **10 modules**; this is not a list of 10 fully delivered subsystems. Source/declaration inventory through the new read-only mutable-data scope:

| Module | Source/declaration files | Implemented responsibility |
| --- | ---: | --- |
| `host` | 64 | Privileged adapters, guarded Static/Node lifecycle, services, diagnostics and persistence |
| `runtime` | 3 | Verified owned-instance state machines and registration |
| `sites` | 2 | Static bundle validation, ZIP/folder parsing and demo specification |
| `config` | 1 | Typed hosting-registry facade backed by `shared` |
| `observability` | 1 | Read-only host snapshot projection |
| `packages` | 1 | Portable Node dependency-planning facade |
| `ai`, `diagnostics`, `inventory`, `shizuku` | 0 each | Registered scope placeholders; no independent implementation files |

A package facade may be a single re-export, not a separate executable. Native Shizuku/Companion bridges and host diagnostics do not mean the empty `src/modules/shizuku` or `src/modules/diagnostics` directories implement those systems.

**Enforced checks:** `scripts/quality/check-structure.mjs` validates registered paths; `check-boundaries.mjs` checks relative imports and host-only imports in **`src/`**; `check-code-budgets.mjs` caps new files and flags selected browser host imports. The latter checks are conservative regex/static scans, **not** a complete TypeScript/Vite dependency graph or runtime isolation proof. The latest A8 scoped boundaries/structure QA passed at `73b2da8`; the newer mutable-data inspector has not been tested or accepted.

**Known debt:** `host` contains 64 of 72 module source/declaration files, and large pinned files remain (`termux-service-admin.ts`, `node-runit-host.ts`). The Vite API composition file is also large. Prefer small extraction by feature/transport contract, preserve ownership guards, and request separately scoped exact-SHA QA before claiming a refactor safe. Details and priorities: [22 November source checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md).
