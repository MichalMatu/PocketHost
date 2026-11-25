---
status: active
owner: core
last_reviewed: 2026-11-25
purpose: Incremental public publishing for owned hosting projects
---

# Cloudflare publishing

Owner resumed **CF1 only** after S7 closure. S8–S12 remain frozen. No public
route, package change, existing tunnel modification or real application
publication is implied by this plan.

| Stage | Scope | Estimated difficulty | State |
| --- | --- | --- | --- |
| CF1 | Quick Tunnel without account, one static site, temporary HTTPS URL | Low | Deployed; public HTTPS acceptance pending |
| CF2 | Owned runit enrollment, lifecycle and reconnect/readback | Low–medium | Deferred |
| CF3 | Cloudflare account setup and scoped API integration | Medium | Deferred |
| CF4 | Named tunnel, domains/subdomains, routing and Node hosting | Medium | Deferred |
| CF5 | Diagnostics, recovery and endurance qualification | Medium | Deferred |

## CF1 implementation and acceptance

- CF1A public origin: scoped A8 QA PASS at `695a3ca`.
- CF1B Quick Tunnel session: scoped A8 QA PASS at `b08e168`.
- CF1C API and shared UI: scoped QA and build PASS at `122f31e72c6bf74743ffeb0ea490b5b2d0d2252b`.
  All 86 mapped UI tests across 12 files passed in three batches.
- Separate guarded A8 DEV deployment at the same SHA: PASS, HTTP 200,
  protected services and dependencies unchanged. See [quality gates](QUALITY_GATES.md).
- No public tunnel started during QA or deployment. Real external HTTPS,
  connector shutdown and publication readback remain unverified against
  a real connector. Next step requires separate approval for a disposable
  public fixture; do not publish an existing site automatically.

## CF1 contract

- Reuse the existing Static website card: Public access, Publish to Internet,
  temporary URL, copy/open, Unpublish, and a link to Services → Cloudflare.
- Extend the existing Cloudflare workspace with the same publication state;
  preserve its external connector diagnostics. Do not create another menu.
- Resolve a site by its existing owned identity, verified running process,
  assigned port and active release. Never accept an arbitrary URL, command,
  port or filesystem path from the browser.
- Use a narrowly scoped loopback public-origin adapter for the selected
  active site only; reject archived release previews, management APIs,
  non-GET/HEAD methods, ambiguous/encoded traversal and foreign targets.
  Keep the existing LAN gateway, admin listener and site release model intact.
- Use the installed cloudflared binary with fixed arguments, isolated
  configuration, explicit user intent and bounded startup. Do not use a
  shell or touch another connector, its config, credentials or DNS.
- Keep a single explicitly owned temporary publication in CF1. Distinguish
  starting, URL assigned, externally verified, failed, stopped and unknown.
  Stop only the exact owned connector; no background restart scheduler.
  CF2 supplies persistent runit lifecycle; a new Quick Tunnel may change URL.
- No tunnel starts on import, page load, reboot, panel restart or tests.
  Preserve existing protected services. Named/shared Pi Zero tunnel design
  remains separate: [shared tunnel proposal](CLOUDFLARE_SHARED_TUNNEL_MVP.md).
- Test local origin and lifecycle with isolated fixtures/fake connector:
  method/path denial, ownership drift, stale responses, malformed URLs,
  startup failure/timeout, stop and restart semantics. A8-only exact-SHA
  QA and separate guarded deployment. A real public HTTPS test requires
  a separately approved disposable fixture; never publish existing sites
  automatically.

[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
are temporary development/demo endpoints, no account/domain required,
without uptime guarantee, limited to 200 in-flight requests and no SSE.
Named tunnels are the production path.

## Later stages

CF2 reuses the existing runit provenance and desired-state contract; no
competing scheduler. CF3 keeps credentials server-side and scope-limited.
CF4 validates hostname collisions, mapping and rollback before changes.
CF5 proves actual HTTPS availability, reconnect, shutdown and recovery.
Use one shared publication model across the Static, Node and Cloudflare
views rather than independent implementations.
