---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-24
purpose: Actual module ownership, implementation coverage and separation limitations
---

# Module ownership and separation

**Boundary:** `apps/admin/src` is browser UI and API clients; `apps/admin/vite.config.ts` and `apps/admin/plugins` are Node-side API bridges; `src/shared` contains portable contracts; `src/modules/host` owns Termux filesystem/process/runit side effects. Other registered modules provide pure policy, validation and projections. Discovery never implies ownership. See [architecture](ARCHITECTURE.md) and [code map](CODE_MAP.md).

The implementation registry now contains **6 modules**, with 74 source/declaration files at the audited B2 revision. Four former documentation-only placeholders are not standalone implementations.

| Module          | Source/declaration files | Implemented responsibility                                          |
| --------------- | -----------------------: | ------------------------------------------------------------------- |
| `host`          |                       66 | Privileged adapters, hosting, services, diagnostics and persistence |
| `runtime`       |                        3 | Verified owned-instance state machines and registration             |
| `sites`         |                        2 | Static bundle validation, ZIP/folder parsing and demo specification |
| `config`        |                        1 | Typed hosting-registry facade backed by `shared`                    |
| `observability` |                        1 | Read-only host snapshot projection                                  |
| `packages`      |                        1 | Portable Node dependency-planning facade                            |

## Retained scope contracts

- **Inventory:** external resources are read-only observations; discovery never grants service ownership. Implemented host observations stay in `host`.
- **Diagnostics:** bounded events and honest unavailable state; health and ownership remain separate. Existing Local Agent console behavior follows the root owner direction. Implementations stay with their host or observability owner.
- **Shizuku:** browser → Termux host → authorized Android-loopback Companion/Binder. No invented privilege; ADB is not root. Existing host/native integration remains untouched; Pro is deferred.
- **AI:** optional future typed APIs; no implicit privileged host action or secret disclosure. No standalone implementation exists.

Reintroduce a separate module only when there is an actual bounded implementation, matching agent policy and module specification. The historical 10-entry registry remains in Git history.

**Enforced checks:** `scripts/quality/check-structure.mjs` validates registered paths; `check-boundaries.mjs` checks relative imports and host-only imports in **`src/`**; `check-code-budgets.mjs` caps new files and flags selected browser host imports. The latter checks are conservative regex/static scans, **not** a complete TypeScript/Vite dependency graph or runtime isolation proof. The G0–G2 baseline passed at `d2bacd0`; B2 exact-source build and boundary/budget checks passed at `179dc5a`. Registry-change structural QA is tracked separately in the roadmap.

**Known debt:** `host` contains 66 of 74 module source/declaration files, and large pinned files remain (`termux-service-admin.ts`, `node-runit-host.ts`). The Vite API composition file is also large. Prefer small extraction by feature/transport contract, preserve ownership guards, and request separately scoped exact-SHA QA before claiming a refactor safe. Details and priorities: [22 November source checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md).
