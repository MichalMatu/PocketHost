---
status: active
owner: core
last_reviewed: 2026-11-19
purpose: Manual read-only Mac screenshot and API lab for A8 private-LAN DEV panel
---

# PocketHost Test Lab

Private owner-only development tool: **observe → screenshot → diagnose → edit → guarded A8 deploy → repeat**. It is not part of the hosted panel, does not start a service, scheduler, browser daemon or GitHub Action.

## Isolation and permissions

- **MacBook Local Agent**, verified by existing private Git host+installation task results, may run a *one-shot read-only* capture on explicit owner approval specifying exact 40-hex **verified A8 live** PocketHost source SHA, route names and GET API scope. No Mac source/build/UI test suites or Android device operations. No prior approval carries forward.
- **Samsung Galaxy A8 Local Agent alone** handles all builds, DEV releases and project tests. No change to the A8 `code → deploy → verify` guard, protected services, existing UX or panel routes.
- A capture creates screenshots and a local HTML gallery under `.test-lab/` (gitignored). They are not pushed to the public GitHub repository or private Local Agent task results. Agent results should return only compact JSON summary. A screenshot can contain sensitive private-LAN data: select, redact and authorize any later transfer individually.
- Chrome uses one new temporary browser context per capture run (no saved cookies or credentials). It navigates each selected route **once**, then resizes that page for the mobile/tablet/desktop captures, reducing Vite DEV request load on A8. The lab refuses WAN/public origins, cross-origin requests, custom routes, arbitrary URL queries and all browser-initiated HTTP writes (non-GET/HEAD requests aborted). GET response bodies and browser console text are never included in task output.
- Do not assume a successful screenshot confirms that a button works, or a running process is HTTP-ready.

## One-shot manual invocation

The Mac already has Google Chrome; `playwright-core` is a separate, opt-in dependency. Installation must be separately approved. No package install is performed by this runner.

```sh
node scripts/test-lab/capture.mjs \
  --base=http://192.168.0.16:18878 \
  --sha=<owner-approved-exact-40-character-source-sha> \
  --routes=dashboard,hosting,projects \
  --api=host,network
```

Use **only** with a fresh exact-live-SHA scope approval. `--base` is passed at execution time (not hardcoded). Default routes: `dashboard,hosting,projects`. Allowed routes: `dashboard,hosting,sites,projects,deployments,logs,services,agent,network`. Allowed GET API selections: `host,network,sites,projects`; no API requests by default. Fixed viewports: mobile 390×844, tablet 768×1024, desktop 1440×900. Override Chrome binary with `POCKETHOST_LAB_CHROME` only on the selected Mac.

Output: private PNG files, `report.json`, `index.html` contact gallery, and one bounded stdout JSON receipt. Reports record navigation HTTP, React rendered-state, page/console/failed-request counts, viewport overflow, and requested GET status/latency; they deliberately omit response bodies, secrets and raw error text.

## Selected thumbnail review via private Git task result

The Mac Lab can also produce an **explicitly requested**, JPEG-compressed, bounded preview from one already captured screenshot. Command `node scripts/test-lab/preview.mjs --run=<capture-directory-name> --shot=dashboard-mobile.png`. The reviewed run and screenshot names must be approved separately before publishing image bytes to the **private** Local Agent result (never the public PocketHost repository). The preview is a deliberately downscaled image, not a pixel-level regression baseline; it may still reveal LAN details, so inspect/redact sensitive UI first. The helper refuses symlink escapes, arbitrary filenames and files above its output byte cap. It does not modify the hosted application.

## Next stage: safe API writes (not yet implemented)

Inventory exact existing settings endpoints and ownership semantics before making an API write adapter. Start only with an **isolated owned DEV fixture** and a tiny per-endpoint method/body allowlist. Each mutation requires separate authorization, expected source/initial state, independent readback and documented rollback. Never add arbitrary POST/PUT/DELETE, generic shell, or an action which may interrupt the LAN gateway, agent, SSH, protected services or off-device backups. A test result is not a deployed change.

**Current state:** tooling source only. No new Mac lab execution, browser installation, A8 deploy, QA PASS or API mutation is claimed.
