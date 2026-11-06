---
status: in-progress
owner: core
last_reviewed: 2026-11-06
purpose: Track P4 managed PhotoMap catalog MVP and native Samsung release gates
---

# P4 — managed PhotoMap TEST catalog MVP

## Scope and source

PocketHost feature branch: `sprint/p3-mvp-integration-20261105`, built on accepted P3 GUI and LAN viewing candidate. Main remains unchanged until native gates pass. Imported PhotoMap source snapshot and original checkout are preserved at the private `PocketHost-Managed` root; source commit `d49e94c9`, release `import-20261106`. Existing PhotoMap TEST server on Samsung is stopped. Raspberry Pi production and IleStoi.pl are strictly out of scope.

Implementation candidate: fixed typed `ManagedProjectPort`, fail-closed host manifest validator, GET-only same-origin localhost DEV route, `/managed-projects` page, tool/version and project lock SHA-256 catalog. Existing P3 static demo management is unchanged. The original 32 vendor routes remain preserved. No package updates, PRoot modifications, PhotoMap start/stop, server registration, LAN ingress changes or automatic startup.

## Device evidence

`pockethost-photomap-managed-import-copy-20261106-v2` finished `done`/exit `0`, publishing the private source, copied SQLite and 2,196 media files with per-file hash validation. External services were unchanged in that import task. No PhotoMap listener or autostart was created.

`pockethost-p4-photomap-preflight-20261106-v1` was rejected as an invalid task by the Local Agent timeout reserve validator **before host command execution**.

`pockethost-p4-photomap-preflight-20261106-v2` finished `done`/exit `0` on physical Samsung aarch64. Versions: Node 26.4.0, npm 11.19.0, git 2.55.0, Python 3.14.6. Verified `photomap-test` registry, source release, imported lock metadata, disabled runtime (`enabled=false`, `launch_allowed=false`, `autostart=false`), external-unfrozen Python PRoot environment, absent PhotoMap runit registration and free loopback port 8010. The original run script still changes into the **old PhotoMap checkout** and executes `scripts/termux-dev.sh serve-debian`; therefore it cannot safely be repurposed as a managed-launch command. The generic `sv status` probes in this preliminary task returned `unknown` because they lacked the full exact service paths; this does **not** establish a service outage or replace the successful import-time external service comparison.

## Test gate and acceptance boundary

Immutable native quality task `pockethost-p4-photomap-managed-catalog-native-quality-20261106-v1` was queued against pinned source `325a5d35619086c561d3e4785b3114cbf5ac1f06` in an isolated new checkout. **Its terminal result and any necessary follow-up validation are required** before accepting P4. That candidate task uses project-local pinned `npm ci` (root and admin), root `npm run check`, admin lint/build and UI tests. Its last command currently references `npm run test`, whereas the real admin script is `test:ui`; if the preceding gates pass it will need a corrected follow-up task. Never treat task publication as test PASS.

No observed cross-device or live-browser P4 confirmation yet. No P4 code merge, panel restart or change to external services. Until the actual native result arrives, this is **P4 candidate / HOLD for deployment**.

## Next gate

Complete native tests on one pinned source, correct any source issues through GitHub commits, then run a guarded separate managed-catalog GET/POST/forged-origin smoke from the actual phone. The runtime actions remain disabled until a future isolated PRoot and process ownership implementation is independently accepted.
