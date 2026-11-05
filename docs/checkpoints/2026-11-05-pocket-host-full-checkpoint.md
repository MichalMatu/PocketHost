---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Full PocketHost P0-P2 functional checkpoint, native quality evidence, outstanding gates and recommended next sprint
---

# PocketHost — P0–P2 Complete Checkpoint and Quality Review (2026-11-05)

## User acceptance and working system

The owner confirmed that the PocketHost panel now **works correctly** after correcting the Base UI menu grouping issue. The preview is opened on the Android device at `http://127.0.0.1:8787/host`. The accepted UI retains the existing **responsive phone layout and native pinch-to-zoom**; no forced desktop canvas, alternate mobile GUI or zoom restriction is introduced.

The product is a **locally hosted PocketHost-owned React dashboard**, not a remote CMS. All 32 original ShadcnStore Vite demo routes/components remain present for later reuse, along with the separately implemented `/host` route. The rendered shell removes the vendor Pro upsell, external shop links, promotional banner and fake vendor account. Upstream MIT copyright/license text remains preserved in `apps/admin/LICENSE.upstream.md`; no vendor account or subscription is required to run the imported MIT code. Demo login, signup, pricing and billing pages are **demonstrations**, not actual PocketHost authentication or payment functionality.

The appearance UX is consolidated into **one top-right menu**: Light, Dark, System, Colors & themes, Panel layout and Reset appearance. The former floating settings cog is removed. The underlying customizer sheet is reused. A real Base UI runtime crash was reported by the user after the first rollout; the fix wraps `DropdownMenuLabel` with `DropdownMenuGroup`. The user subsequently confirmed normal operation.

## Architecture and capabilities present

| Area               | Delivered                                                                                                              | Boundary                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P0 foundation      | Typed module boundaries, owner instructions, quality scripts, ADRs, docs, tests                                        | Not a host daemon or independent deployment                                     |
| Full UI shell      | Complete preserved 32-route React/Vite/TypeScript, Base UI/shadcn components, charts/forms/settings, responsive layout | Most routes still show upstream demonstration content                           |
| PocketHost `/host` | Read-only live health snapshot, uptime/memory, six fixed runit service states, storage total/available                 | Fixed allowlist only; no arbitrary process scanning, no secret or path exposure |
| Local Agent        | Separate private `runit` supervisor state visible as an external service                                               | Monitoring only; PocketHost cannot restart Agent                                |
| UI appearance      | Unified header dropdown, theme presets, layout sheet, reset, responsive Android/pinch                                  | Most recent interactive UI acceptance: owner, not automated Chrome CDP          |
| Commercial UI      | PocketHost branding; original MIT notice retained; no ShadcnStore signup or Pro requirement                            | Imported source only, not separately sold premium add-ons                       |
| API                | DEV-only `GET /api/v1/host/snapshot` on loopback, response sanitization, origin/host/method rejection                  | No production auth, WAN control plane, TLS or service-management API            |

**Explicitly not implemented:** PocketHost-owned service lifecycle/registry, own site deployment, package installation through the UI, domain/DNS setup, AI publishing, public remote administration, multi-tenant auth, productionized service process, Android APK or PocketHost autostart. External services including IleStoi.pl and Local Agent remain outside PocketHost ownership and management.

## Verified repository positions

- `PocketHost/main` observed at `8378663725f10beacf9c527f194e7f568170284d` at the start of this checkpoint.
- Accepted live appearance implementation: `feat/appearance-header-menu-20261105` at `0645ee208c449f716edca1a22d64c0731993e127`. It is **not asserted to be merged to main**.
- Previous commercial cleanup: `sprint/p1-closeout-20261105` at `664e4938c1b34bbb5cd5b4c22ca70a6cde3d3a85`.
- P1.1 source/feature checkpoint: `feat/host-health-v1` at `113a7d4d5dc541b7b15bc3980c7172456b602d33`.
- This checkpoint's documentation branch: `checkpoint/pocket-host-ui-quality-20261105`. Do not interpret a documentation branch as an authorization to merge or restart a host service.

## Quality and real-hardware evidence

| Gate                                  | Observed outcome                                                                                                                                                        | Evidence                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Foundation Gate 0, latest Base UI fix | **PASS — 31/31** native Termux tests; boundary, docs, negative host cases and new menu-group regression                                                                 | `pockethost-appearance-menugroup-fix-native-20261105-v1`                                                                            |
| Admin ESLint, latest fix              | **PASS** on native Termux                                                                                                                                               | Same task                                                                                                                           |
| Admin TS/Vite build, latest fix       | **PASS** on native Termux                                                                                                                                               | Same task                                                                                                                           |
| Guarded live preview restart          | **PASS**, exact source `0645ee2`, PocketHost-owned prior process verified; rollback provisioned                                                                         | `pockethost-menugroup-guarded-restart-20261105-v1`                                                                                  |
| Live HTTP routes                      | `/host`, `/dashboard`, `/settings/connections`: **200**; updated Vite module: **200**                                                                                   | Same restart receipt                                                                                                                |
| Read-only API boundary                | `GET` **200** / 6 fixed services; rejected `POST` **405**, foreign Origin **403**                                                                                       | Same restart receipt                                                                                                                |
| Earlier actual Android Chrome UI      | 31 concrete routes rendered, visual viewport scale **1.0 → 1.7**, screenshot capture; later branding smoke **6/6**                                                      | `pockethost-closeout-onphone-chrome-route-zoom-20261105-v1`; `pockethost-commercial-clean-ui-real-android-smoke-20261105-v1`        |
| Latest Base UI menu interaction       | **Owner accepted after runtime fix**; _not_ independently reproduced with Android CDP after the fix because ADB had no authorized device                                | Conversation user confirmation; ADB bridge preflight `pockethost-menugroup-adb-cdp-bridge-20261105-v1`                              |
| Full **root Gate 1**                  | **HOLD — audit complete:** Gate 0 PASS, Markdownlint PASS, ESLint PASS, TypeScript PASS; Prettier fails on 17 owner files; generated root lockfile is not yet committed | `pockethost-checkpoint-gate1-complete-audit-20261105-v1` (`done / exit 0` for audit script; nested full `npm run check` **exit 1**) |

**Actual full native audit (2026-11-05):** `pockethost-checkpoint-gate1-complete-audit-20261105-v1` on source `0645ee2`, Termux Node `v26.4.0` and npm `11.19.0`: root lock generated locally (98,505 bytes) and `npm ci` installed 188 packages; **Gate 0 31/31 PASS**, Markdownlint **51 files / 0 errors**, root ESLint PASS, root TypeScript PASS. Prettier reports exactly **17 owner files** requiring formatting; therefore **full `npm run check` FAIL** at the formatting step. The generated root `package-lock.json` was **untracked** and is not in GitHub yet. The earlier Node type declaration problem is resolved for this audit. A separate controlled quality-cleanup task `pockethost-quality-gate1-format-lock-closeout-20261105-v1` was submitted, but has **no accepted terminal result in this checkpoint**. Do not claim Gate 1 PASS or a committed root lockfile until verified.

## Safety, limitations and risks

1. **HIGH — production exposure:** The preview uses the Vite development server on `127.0.0.1:8787`; its auth demo routes are not real authentication. Do not connect it to public internet, proxy/tunnel or an externally accessible interface.
2. **HIGH — process ownership:** A future runtime may only manage explicit PocketHost-owned instances with a persisted identity. Never infer ownership from an observed PID/port. IleStoi.pl, Cloudflared, SSH, Mosquitto, healthwatch and Local Agent must remain external/read-only.
3. **MEDIUM — GUI regression:** The Base UI `MenuGroupContext` crash passed static tests and build but failed when users opened the actual menu. Introduce **component interaction/E2E browser acceptance** for menu and customizer flows before further UI releases. HTTP 200 does not prove React rendered.
4. **MEDIUM — release reproducibility:** Root Gate 1, lockfile and formatting cleanliness remain separate from the successfully built admin package. Package versions should stay pinned.
5. **MEDIUM — deployment process:** DEV startup remains manual; Local Agent boot resilience is independent. Avoid introducing PocketHost autostart as a workaround.
6. **LOW — demo ambiguity:** Original billing/signup pages are retained intentionally for reuse; clearly distinguish demo content from real PocketHost controls and permissions.

## Recommended next development sprint

**First complete the quality-closeout prerequisite:** fix root Gate 1 failures without touching imported UI unnecessarily, commit and verify the root lockfile, run native `npm ci && npm run check`, then check a real Android browser interaction opening the appearance dropdown, selecting Light/Dark/System, opening both customizer tabs, resetting, and navigating away/back. Use a pinned-source receipt and explicit acceptance. If ADB is disconnected, treat automated UI interaction as unverified and use owner feedback as a separate evidence class.

**Then P3 — PocketHost-owned single test site (recommended functional sprint):**

1. Add an explicit owned-site registry, with stable IDs, isolated document root and a preview port chosen only after proving it is free.
2. Start/stop/restart **only** the newly created PocketHost test server via the host adapter, not a discovered external service.
3. Add front-end site summary and safe status/actions in existing reusable cards, while retaining demo views.
4. Test bad paths, port collisions, double start, stale state, process exit, permissions and rollback, plus fail-closed controls for IleStoi.pl and Local Agent.
5. Keep manual start and loopback binding for admin; no external publishing, package installation or boot hooks.

After P3, choose between read-only diagnostics/config inventory (P4 planning) and an opt-in deployment pathway. Do not begin AI publishing, domains, APK or public control until the security/ownership threat model and device acceptance are complete.

## Closure condition

The **working P2 panel and latest runtime fix are accepted**, with a clear separate **root Gate 1 HOLD** and future E2E regression requirement. This checkpoint establishes the next chat's starting point without redoing accepted P0/P1/P1.1 UI and host-status work.
