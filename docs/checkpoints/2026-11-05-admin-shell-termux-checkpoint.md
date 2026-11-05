---
status: accepted
owner: ui
last_reviewed: 2026-11-05
purpose: Record the complete ShadcnStore admin UI native Termux MVP and exact outstanding blockers
---

# PocketHost: full admin shell on Android Termux — 2026-11-05

## Accepted scope

- **Target:** Samsung Android Termux host `android-termux-10520`, installation `6be16f1d-194b-4f07-b377-3d4bb218fcd7`; project checkout separate at `~/Projects/PocketHost`. PocketHost has **no autostart**.
- **UI:** complete upstream `shadcnstore/shadcn-dashboard-landing-template` **Vite** directory, upstream commit `866423741fa4b62d5e9427603cb2174aedf00f80`, MIT license retained. All **32 route entries** remain, including unused demo views; desktop-first React/Vite/shadcn Base UI with native browser pinch left enabled.
- **User acceptance:** user confirmed the local dashboard GUI works. This is confirmation of the *visible demo*, not proof of working hosting controls.

## On-device execution receipts

All development commands ran on **real Termux via its existing Local Agent host-command lane**, not Mac or a separate sandbox. Historical failed attempts are retained, not overwritten.

1. `pockethost-ui-preflight-20261105-v1`: Termux aarch64, Node `v26.4.0`, npm `11.19.0`, Git `2.55.0`, port 8787 initially free. Initial private Git fetch denied.
2. `pockethost-ui-public-clone-build-20261105-v2`: after repository switched **public**, HTTPS clone PASS; malformed repository structure script blocked Gate 0.
3. `pockethost-ui-gatefix-import-preview-20261105-v4`: repaired structure gate PASS (**12/12**), full template import PASS (**32 routes**); documentation gate wrongly imposed project formatting on unmodified upstream license.
4. `pockethost-ui-vendor-qa-build-preview-20261105-v5`: after fixing vendor-doc exemption and adding two regression tests, **Gate 0 14/14 PASS**, dependency install `435 packages` PASS, **Vite production build PASS**, **admin ESLint PASS**, local preview `http://127.0.0.1:8787/dashboard` HTTP **200**, HTML React root found, Vite process running. Build and lint were executed on Termux.
5. `pockethost-vendor-commit-push-20261105-v1`: **262 staged vendor files**, local commit `1f00063efb9922e6251727fcd053c38f6bf06d90` succeeded using command-scoped commit identity. **GitHub push FAILED** (no HTTPS username/credentials on phone). Local preview still HTTP 200.
6. `pockethost-v5-npm-process-readonly-20261105-v1`: Mac-initiated **read-only SSH** confirmed Vite PID and `dist` on Termux; this was not a Mac build. Attempted Mac localhost SSH forward returned connection reset and was removed; no public tunnel opened.

## Git state and publication

- GitHub `main` at checkpoint start: `0c0014e17444e77c02b421be069913fadeb50583`.
- GitHub feature `feat/admin-shell-v1` at checkpoint start: `2d948d494129863315e1788a8ae1642f12088995`.
- **Phone-only unpushed vendor commit:** `1f00063efb9922e6251727fcd053c38f6bf06d90`, containing complete template. Do not claim the source is available in GitHub feature branch until separately confirmed. Never invent GitHub credentials, expose private key material, or configure global Git identity. Use an authorized transport preserving exact vendor commit/tree where possible.

## Local Agent recovery and autostart issue

The Android Local Agent had stopped: private `runsvdir` absent even though the regular Termux service manager and IleStoi.pl services were up. Mac Local Agent's established SSH profile successfully invoked the dedicated `~/.termux/boot/90-local-agent` hook; it started private Agent PID `19589`. It then claimed and published the PocketHost tasks. Logs show the boot hook had last run on **2026-11-02**, but the separate Agent manager did not remain live. **Root cause of subsequent manager termination is not proven; permanent watchdog/endurance fix is pending**. Do not change unrelated `00-services`, IleStoi.pl runit entries or production processes. **No need to manually open Termux:Boot just to revive a currently running Agent.**

## Explicitly not accepted

- Real host/Termux inventory backend and typed API: **not implemented**.
- Admin authentication and network exposure: **not approved**; Vite preview restricted to `127.0.0.1:8787`.
- Full root `npm run check` Gate 1: **not proven**. Browser-automation, zoom/pan, keyboard/mouse/accessibility screenshots: **not proven**, despite user's successful manual viewing.
- Future APK/Capacitor, package operations, service management and AI hosting: **not implemented**.
- No measured claim of IleStoi.pl health *after* this build, beyond its processes being excluded from PocketHost changes.

## Publication follow-up (same day)

After the above historical checkpoint was written, the **262-file upstream UI commit was successfully transferred** from Termux via the existing Mac→Termux SSH profile and published to GitHub `feat/admin-shell-v1`, exact tip `1f00063efb9922e6251727fcd053c38f6bf06d90`. The durable `local-agent` Mac-host result `pockethost-vendor-git-transfer-mac-20261105-v1` reports authenticated Git transport only: 5,434,564-byte verified bundle, exact source parent match, 262 imported files including MIT notice, non-force push PASS and subsequent remote SHA match. No PocketHost tests, npm or build were executed on Mac.

The next isolated development branch `feat/host-overview-v1` contains a fixed-allowlist, read-only `/host` status screen and DEV-only host snapshot middleware. This source remains under **native Termux qualification**, separate from the accepted demo UI.

## Next isolated sprint

1. Securely publish the complete source from the phone to GitHub (without changing phone's global Git credentials or executing PocketHost tests on Mac); verify remote tree contains 262 imported files and license.
2. Implement a **separately permissioned, loopback-only, read-only** host snapshot API with deterministic fake-adapter contract tests. No arbitrary commands, external service mutation or secrets. Connect a focused diagnostics view to this API while leaving the other upstream demo screens untouched.
3. Repeat Gate 0, admin lint/build and a device HTTP/route check; keep visual acceptance separate.
4. Revisit private Agent manager lifetime and Termux:Boot only as an independently tested recovery change; never restage the already accepted historical release migration.
