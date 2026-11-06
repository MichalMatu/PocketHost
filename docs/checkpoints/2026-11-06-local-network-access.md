---
status: in-progress
owner: core
last_reviewed: 2026-11-06
purpose: Record owner-approved LAN access goal and separate safety gates for PocketHost and other sites
---

# Local network access — owner decision (2026-11-06)

The owner explicitly wants simple one-click access from the MacBook and other devices on the same trusted home LAN. The desired destinations are the PocketHost admin panel and the single PocketHost-owned test site. The owner also requested checking local access for IleStoi.pl and PhotoMap.

## Important boundaries

- A trusted Wi-Fi network is an operational assumption, **not** authentication. A newly exposed administrative API must require its own credential and explicit opt-in. No secrets in the repository or browser URLs; no WAN ingress, router forwarding, public tunnel or default all-interfaces bind.
- The current PocketHost panel (Vite on 127.0.0.1:8787) and owned site (127.0.0.1:18787) are local-only. Do not simply set host=0.0.0.0 or bypass the fixed Host/Origin checks in the P3 DEV mutation API.
- PocketHost LAN access requires a separate scoped design, negative tests, real Termux checks, exact device LAN address, safe rollback and an explicit launch. Any direct LAN proxy must enforce authentication, private-network binding and request validation. Preserve own-process ownership and no automatic startup in DEV.
- IleStoi.pl is production on the Samsung behind a Cloudflare tunnel and local port 8001. Its public user interface is already at https://ilestoi.pl; do not change its productive listener or tunnel for a convenience link.
- PhotoMap is production on a separate Raspberry Pi Zero 2W behind Cloudflare at https://photomap.pl, not the Samsung Termux test copy (that copy is stopped). Do not deploy on Pi or restart its service merely to enable LAN.
- A browser bookmark to public domains is immediately one-click and does not require a LAN-facing administrative listener. For true offline/direct LAN hostnames, audit each host and router/DNS prerequisites independently before any production changes.

## Evidence and status

PocketHost P3 release quality on source a76958a passed 42/42 native tests plus six UI tests; the site was run and verified at 127.0.0.1:18787. The guarded P3 dashboard cutover task pockethost-p3-panel-guarded-cutover-20261106-v1 completed done/exit 0; it verified new /owned-site and the old preview rollback path while leaving six external services running.

LAN exposure is **not yet an accepted implementation**. This checkpoint is the decision and audit starting point, not a claim that any new listening port exists.

## Next acceptance gate

1. Confirm LAN IP and both device deployments using read-only probes, without accessing credentials.
2. Design opt-in authenticated LAN gateway with explicit binding to the current private interface; test CSRF, Host, Origin, method, paths and WebSocket behavior.
3. Native Termux lint, types, build and security negative tests on a pinned source SHA.
4. Controlled live LAN test from a second device, verify independent existing services remain unchanged, record actual links.
5. Update documentation and mark accepted only after hardware and browser acceptance.

## Scope narrowed at owner's request

This sprint implements **PocketHost only**. IleStoi.pl stays on its existing public HTTPS hostname with no change to the productive Samsung backend, tunnel, ports or service. PhotoMap is excluded. Access from the MacBook should be a saved local link rather than repeated SSH forwarding.

## LAN gateway candidate

- `src/modules/host/lan-gateway.mjs` is an explicit, manually launched, password-protected HTTP gateway. It must bind to one exact RFC1918 IPv4 address belonging to the Samsung Wi-Fi interface, not `0.0.0.0`.
- The admin LAN port is `18878` with browser Basic authentication and same-origin request checks. The owned demonstration site uses `18879` and is read-only for GET/HEAD without authentication. Both proxy only to existing `127.0.0.1` services; do not open the upstream 8787 or 18787 listeners.
- Admin username is `pocket`. The high-entropy password is generated and kept only in a `0600` file on the phone under its private Termux user home; never place it in Git, an agent receipt or request arguments.
- The existing P3 API checks still require the original loopback Host, Origin and explicit intent header after the authenticated gateway validates the LAN request. The UI uses same-origin credentials and transforms the preview link into the dedicated read-only LAN site link when reached via port 18878.
- All LAN links remain HTTP and Basic credentials are not encrypted end-to-end. This mode is restricted to the user's trusted Wi-Fi; do not use it on shared/guest networks, public internet or via router port forwarding. Prefer SSH if that assumption changes.
- This is a **candidate**, not permission for automatic startup or permanent service registration. The branch must pass Termux native Gate 1, admin lint/build/UI, gateway negative HTTP tests, an actual guarded LAN smoke and user acceptance before release.
