---
status: in-progress
owner: host
last_reviewed: 2026-11-05
purpose: Define read-only Host overview source scope and native qualification
---

# Host Overview P1 — implementation checkpoint

## Scope

Feature branch `feat/host-overview-v1` based on **published** full vendor commit `1f00063efb9922e6251727fcd053c38f6bf06d90`. Keep the full 32-route ShadcnStore source; add one `/host` route and one new sidebar entry. Do not remove demo screens.

Introduce the fixed-allowlist `src/modules/host/host-snapshot.ts`: read-only `sv status` probes for IleStoi.pl (runit `wreckscanner`) and four named surrounding services, plus sanitized Node/platform/uptime/free-memory metadata. No raw command output, arbitrary service names or write API. Service ownership remains **external**.

The Vite middleware is **only** for loopback-only manual DEV preview on port 8787; GET-only `/api/v1/host/snapshot` with strict host/origin constraints. No PocketHost boot autostart, package install, process killing, production config edits or new public ingress.

## Mandatory acceptance still pending

- Test the source on real Termux **through its existing Local Agent host-command lane**: `npm run check:foundation`, `npm run build` and `npm run lint` from `apps/admin`.
- Test `GET /api/v1/host/snapshot` HTTP 200, allowlisted JSON, valid/unknown service states, denied POST (405), denied foreign Origin (403), and unchanged existing `/dashboard`.
- Check local preview binding to 127.0.0.1 only and no changes to existing IleStoi.pl/Local Agent services.
- Verify on the user's physical Android browser (including touch/zoom). No automated visual PASS without real evidence.

Until those checks and actual task-result IDs are recorded, **source ready, native feature acceptance pending**.
