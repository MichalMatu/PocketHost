---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Record exact-SHA O1 and manually controlled trusted-LAN acceptance on Samsung
---

# PocketHost O1 and trusted LAN — native and live checkpoint

## Source and release identity

- Application source: `315e0632a53444038fbe159dd5a075cdc7fb72c6`.
- Git branch: `main`; no feature branch, force push or automation deployment.
- All native builds and runtime commands executed on the authorized
  Samsung Termux Local Agent, not on a Mac or in a sandbox.
- Documentation commits after this SHA are not a different tested
  application source; verify their own documentation gates.

## G2 native acceptance

- `pockethost-lan-settings-guarded-live-cutover-315e063-20261107-v1`:
  terminal failed at a _pre-cutover old-baseline identity assertion_,
  **but** its recorded `npm run check:all` completed with exit 0
  for exact source `315e063`. No running service was changed by
  that attempt. The UI test phase reported **19/19 PASS**.
- Subsequent live handover task
  `pockethost-lan-settings-cutover-315e063-live85a963-20261107-v1`:
  terminal `done` / exit 0 / `PASS`. It explicitly reused the
  successful exact-SHA G2 result, verified the true previous live SHA
  `85a9634978969c2c6c43ae7a1ab644fedeba3841`,
  required exact known source blob identities and verified
  recorded PocketHost process PID/start ticks before any signal.

## G3 bounded Samsung live acceptance

The accepted live task checked these facts:

- The PocketHost-owned loopback panel, `/observability`,
  `/settings/network`, GET O1 and network access APIs were healthy.
- The previously running PocketHost-owned LAN gateway was replaced
  with a gateway owned by the current admin session, preserving
  exact phone interface `192.168.0.100` and ports `18878` / `18879`.
- LAN admin routes and O1 GET API returned HTTP 200.
  Foreign Origin was refused with 403; write POST to the demo
  gateway was refused with 405. The demo GET remained 200.
- The PocketHost-owned P3 demo content/version was unchanged.
  All six external Termux services remained running and unchanged.
  Imported PhotoMap TEST port `8010` stayed closed.
- No Termux package mutation, new permissions, external service
  signal, public tunnel, router forwarding or autostart occurred.

## Real LAN browser links

- Admin observability:
  `http://192.168.0.100:18878/observability`
- Manual network access settings:
  `http://192.168.0.100:18878/settings/network`
- Owned demonstration site:
  `http://192.168.0.100:18879/`

These are HTTP-only private-Wi-Fi links, not secure public
administration. The owner previously approved access without a login
on the trusted home LAN. Any device on that subnet can access
the demo admin, so do not expose these ports to public or guest Wi-Fi.

## Boundaries and follow-up

- The admin manages only a gateway it starts in its own session.
  It does not adopt or stop unknown listeners.
- O1 CPU may be unavailable; Samsung restricted `/proc/stat`,
  `/proc/net/dev` and sysfs battery without changing permissions.
  Do not present missing readings as zero.
- Real new-version Mac Chrome visual/keyboard acceptance remains
  **open** until the owner verifies the new screens. The native
  HTTP checks do not substitute for a human browser interaction.
- P3 complete Chromium keyboard/ARIA approval, physical PRoot
  orphan recovery and real PhotoMap activation remain separate
  holds. No automatic recovery or arbitrary shell API.

Continue from fresh `main` and the
[canonical handoff](../HANDOFF_NEXT_CHAT.md). Do not replay
already accepted exact-SHA source tests without a reason.
