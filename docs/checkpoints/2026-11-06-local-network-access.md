---
status: in-progress
owner: core
last_reviewed: 2026-11-06
purpose: Record owner-approved LAN access goal and separate safety gates for PocketHost and other sites
---

# Local network access — owner decision (2026-11-06)

The owner explicitly wants simple one-click access from the MacBook and other devices on the same trusted home LAN. The desired destinations are the PocketHost admin panel and the single PocketHost-owned test site. The owner also requested checking local access for IleStoi.pl and PhotoMap.

## Important boundaries

- A trusted Wi-Fi network is an operational assumption, **not** authentication. The owner explicitly selected no login/password on this restricted private LAN; keep exact-interface binding and request protections. No secrets in the repository or browser URLs; no WAN ingress, router forwarding, public tunnel or default all-interfaces bind.
- The current PocketHost panel (Vite on 127.0.0.1:8787) and owned site (127.0.0.1:18787) are local-only. Do not simply set host=0.0.0.0 or bypass the fixed Host/Origin checks in the P3 DEV mutation API.
- PocketHost LAN access requires a separate scoped design, negative tests, real Termux checks, exact device LAN address, safe rollback and an explicit launch. Any direct LAN proxy must enforce private-network binding and request validation. Preserve own-process ownership and no automatic startup in DEV.
- IleStoi.pl is production on the Samsung behind a Cloudflare tunnel and local port 8001. Its public user interface is already at <https://ilestoi.pl>; do not change its productive listener or tunnel for a convenience link.
- PhotoMap is production on a separate Raspberry Pi Zero 2W behind Cloudflare at <https://photomap.pl>, not the Samsung Termux test copy (that copy is stopped). Do not deploy on Pi or restart its service merely to enable LAN.
- A browser bookmark to public domains is immediately one-click and does not require a LAN-facing administrative listener. For true offline/direct LAN hostnames, audit each host and router/DNS prerequisites independently before any production changes.

## Evidence and status

PocketHost P3 release quality on source a76958a passed 42/42 native tests plus six UI tests; the site was run and verified at 127.0.0.1:18787. The guarded P3 dashboard cutover task pockethost-p3-panel-guarded-cutover-20261106-v1 completed done/exit 0; it verified new /owned-site and the old preview rollback path while leaving six external services running.

LAN exposure is **not yet an accepted implementation**. This checkpoint is the decision and audit starting point, not a claim that any new listening port exists.

## Next acceptance gate

1. Confirm LAN IP and both device deployments using read-only probes, without accessing credentials.
2. Design opt-in trusted-LAN gateway with explicit binding to the current private interface; test CSRF, Host, Origin, method, paths and WebSocket behavior.
3. Native Termux lint, types, build and security negative tests on a pinned source SHA.
4. Controlled live LAN test from a second device, verify independent existing services remain unchanged, record actual links.
5. Update documentation and mark accepted only after hardware and browser acceptance.

## Scope narrowed at owner's request

This sprint implements **PocketHost only**. IleStoi.pl stays on its existing public HTTPS hostname with no change to the productive Samsung backend, tunnel, ports or service. PhotoMap is excluded. Access from the MacBook should be a saved local link rather than repeated SSH forwarding.

## LAN gateway candidate

- `src/modules/host/lan-gateway.mjs` is an explicit, manually launched, login-free HTTP gateway. It must bind to one exact RFC1918 IPv4 address belonging to the Samsung Wi-Fi interface, not `0.0.0.0`.
- The admin LAN port is `18878` without login; with same-origin request checks. The owned demonstration site uses `18879` and is read-only for GET/HEAD without authentication. Both proxy only to existing `127.0.0.1` services; do not open the upstream 8787 or 18787 listeners.
- The existing P3 API checks still require the original loopback Host, Origin and explicit intent header after the LAN gateway validates the request. The UI uses same-origin credentials and transforms the preview link into the dedicated read-only LAN site link when reached via port 18878.
- All LAN links remain HTTP without TLS; all LAN traffic, including admin commands, is unencrypted. This mode is restricted to the user's trusted Wi-Fi; do not use it on shared/guest networks, public internet or via router port forwarding. Prefer SSH if that assumption changes.
- This is a **candidate**, not permission for automatic startup or permanent service registration. The branch must pass Termux native Gate 1, admin lint/build/UI, gateway negative HTTP tests, an actual guarded LAN smoke and user acceptance before release.

## Termux LAN launch proof — 2026-11-06

This section supersedes the earlier LAN implementation HOLD while preserving the outstanding real-Mac browser acceptance gate.

- **Source:** exactly `4ebea2505a2af8830ee8d14b0235fd1493df0b5e`, deployed to the existing `~/Projects/PocketHost-P3-MVP-ReleaseQA-20261106` checkout. The repository `main` remains unchanged at `8378663725f10beacf9c527f194e7f568170284d`.
- **Native quality:** `pockethost-lan-final-native-quality-20261106-v2` terminal `done`, exit 0, `pass:true` on the physical Samsung Termux. Root Gate 1 PASS (46/46 Node tests including LAN security, Markdownlint 57 documents/zero errors, Prettier, ESLint, TypeScript), admin lint/build PASS, appearance interactions 6/6 PASS, P3 lifecycle/contract 9/9 PASS and clean exact-source worktree.
- **Fresh safety preflight:** `pockethost-lan-fresh-cutover-preflight-20261106-v1` `done`/exit 0/`ready:true`: original preview owner verified, both LAN ports free, local panel/site HTTP 200, all six observed external services running, exact source scripts/adapter unchanged between old and new revisions.
- **Live cutover:** `pockethost-lan-guarded-live-cutover-20261106-v1` `done`/exit 0/`result:LAN_RUNNING`. The task stopped only the verified PocketHost admin preview, moved its existing checkout to the pinned tested source and restarted the preview with the opt-in P3 flag. **The separately owned static demo on port 18787 was not stopped**; its version remained 1. The explicit LAN gateway was started manually and left running; its owner PID/start-ticks record and high-entropy password are local-only, outside Git.
- **Actual LAN listener tests on Samsung:** admin `192.168.0.100:18878` returned 401 without Basic authentication and 200 with valid phone-stored credentials; static demo `192.168.0.100:18879` returned GET/HEAD 200 (v1 HTML), POST 405, foreign-origin 403. Foreign admin Host/Origin returned 403. Direct upstream ports 8787 and 18787 remained loopback-only. Six external service states were identical before and after.
- **Use from trusted MacBook LAN:** `http://192.168.0.100:18878/owned-site` (username `pocket`; read the unique password locally on the Samsung with `cat ~/.local/state/pockethost/lan-password`), or `http://192.168.0.100:18879/` for the read-only demo page. Never record the password in source, agent receipts or screenshots.
- **Open acceptance:** These HTTP checks were executed on the phone; **a real Chrome navigation from the MacBook and visual/interactive acceptance by the owner have not yet been reported**. Do not merge to `main` or claim a production-secure authorization release. The gateway uses HTTP Basic, which is plaintext over the WLAN, so it is allowed only on the owner's trusted local network. No autostart, WAN tunnel, router forwarding or changes to IleStoi.pl / PhotoMap.
- **Rollback:** stop only the exact verified LAN gateway PID using its local owner record, leaving 8787/18787 intact; restore the previous preview commit on the same independent checkout only if necessary, with its own verified PID record. Never use broad `pkill`, touch other services, or infer permission from a port alone.

The standalone read-only post-launch inspection is tracked as `pockethost-lan-poststart-independent-health-20261106-v1`. Its terminal receipt should be read before marking persistent post-start health accepted.

## Owner change — login removed (2026-11-06)

The owner reaffirmed that this is a trusted home network and explicitly requested removing the LAN login and password prompt. The panel is intended to open with one click at `http://192.168.0.100:18878/owned-site`. Authorization to remove login does **not** extend to opening any additional Termux services, changing IleStoi.pl, enabling WAN access, or making startup automatic.

The updated gateway has no Basic authentication or password-file dependency. It continues to bind only to the Samsung's exact RFC1918 interface, require the expected Host and same-origin/Fetch Metadata rules, strip injected upstream authorization headers, and restrict the demo site to GET/HEAD. Anyone with network access to this Wi-Fi can use the PocketHost demo admin actions. Keep this deployment only on the owner's private, non-guest LAN.

The earlier password-based LAN launch receipt is historical evidence and no longer describes the desired configuration. A fresh full Termux source gate and a guarded restart of **only** the owned LAN gateway must both pass before this no-login change is marked live. No independent Mac browser acceptance has been recorded.
