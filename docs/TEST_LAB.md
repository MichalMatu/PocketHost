---
status: active
owner: core
last_reviewed: 2026-11-27
purpose: Manual read-only Mac screenshot and API lab for A8 private-LAN DEV panel
---

# PocketHost Test Lab

Private owner-only development tool: **observe → screenshot → diagnose → edit → guarded A8 deploy → repeat**. It is not part of the hosted panel, does not start a service, scheduler, browser daemon or GitHub Action.

## Isolation and permissions

- **MacBook Local Agent**, verified by existing private Git host+installation task results, may run a _one-shot read-only_ capture under standing owner consent, pinned to exact 40-hex **verified A8 live** PocketHost source SHA, route names and GET API scope. No Mac source/build/UI test suites or Android device operations. The task must explicitly name the approved scope.
- **Samsung Galaxy A8 Local Agent alone** handles all builds, DEV releases and project tests. No change to the A8 `code → deploy → verify` guard, protected services, existing UX or panel routes.
- A capture creates screenshots and a local HTML gallery under `.test-lab/` (gitignored). They are not pushed to the public GitHub repository or private Local Agent task results. Agent results should return only compact JSON summary. A screenshot can contain sensitive private-LAN data: select, redact and authorize any later transfer individually.
- Chrome uses one new temporary browser context per capture run (no saved cookies or credentials). It uses one browser page, follows same-origin React Router sidebar links for subsequent routes (with bounded fallback), then resizes that same page for mobile/tablet/desktop screenshots. This reduces repeated Vite module downloads on A8. The lab refuses WAN/public origins, cross-origin requests, custom routes, arbitrary URL queries and all browser-initiated HTTP writes (non-GET/HEAD requests aborted). GET response bodies and browser console text are never included in task output.
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

Use **only** with an explicit exact-live-SHA scope under standing owner consent. `--base` is passed at execution time (not hardcoded). Default routes: `dashboard,hosting,projects`. Allowed routes are the fixed aliases in `scripts/test-lab/artifact-names.mjs`; arbitrary route URLs and queries remain prohibited. Allowed GET API selections: `host,network,sites,projects`; no API requests by default. Fixed viewports: mobile 390×844, tablet 768×1024, desktop 1440×900. Override Chrome binary with `POCKETHOST_LAB_CHROME` only on the selected Mac.

Output: private PNG files, `report.json`, `index.html` contact gallery, and one bounded stdout JSON receipt. Reports record navigation HTTP, React rendered-state, page/console/same-origin-failed, canceled, and deliberately blocked request counts, viewport overflow, and requested GET status, latency, MIME, JSON validity and response-shape checks; they deliberately omit response bodies, secrets and raw error text.

For a matching shared Command UI comparison, opt in with `--routes=dashboard --command-search=true`. The Lab opens only the page-search dialog, captures the dialog at the three fixed viewport sizes, records text-free geometry, and closes it without choosing a command. Images remain local. A missing dialog capture is an optional capture error and cannot establish visual acceptance.

## Selected thumbnail review via private Git task result

The Mac Lab can also produce an **explicitly requested**, JPEG-compressed, bounded preview from one already captured screenshot. Command `node scripts/test-lab/preview.mjs --run=<capture-directory-name> --shot=dashboard-mobile.png`. The reviewed run and screenshot names must be approved separately before publishing image bytes to the **private** Local Agent result (never the public PocketHost repository). The preview is a deliberately downscaled image, not a pixel-level regression baseline; it may still reveal LAN details, so inspect/redact sensitive UI first. The helper refuses symlink escapes, arbitrary filenames and files above its output byte cap. It does not modify the hosted application.

## Next stage: safe API writes (not yet implemented)

Inventory exact existing settings endpoints and ownership semantics before making an API write adapter. Start only with an **isolated owned DEV fixture** and a tiny per-endpoint method/body allowlist. Each mutation requires separate authorization, expected source/initial state, independent readback and documented rollback. Never add arbitrary POST/PUT/DELETE, generic shell, or an action which may interrupt the LAN gateway, agent, SSH, protected services or off-device backups. A test result is not a deployed change.

**Verified 19 November:** Mac Lab one-page SPA capture at tool source `c762ec3` and A8 live `f8ab416` produced **9/9 rendered screenshots**, zero horizontal overflow and zero JS exceptions. API host/network returned HTTP 200 with JSON and response-shape PASS. A later classified capture at `907b4af` also rendered 9/9; some subsequent runs were incomplete during transient LAN/module failures. Geometric inspection revealed small tap targets in the header and Hosting, subsequently addressed by A8 source commits `32ea32d` and `5351d88`. **Mac captures do not establish full interactive acceptance or source-level QA.** Test Lab API writes remain unimplemented.

**Post-deploy verified 19 November — A8 `5352c09`:** guarded A8 release **PASS** with HTTP 200, matching source/owner markers and protected services unchanged. Exact-source A8 syntax, format, structure, boundaries, lint and Node tests **PASS**. Paired Mac one-shot Lab `pockethost-lab-mac-vite-timeout-postdeploy-5352c09-20261119-v1` captured **9/9 rendered** Dashboard/Hosting/Projects views (390/768/1440px), **zero** horizontal overflow, tiny targets, JavaScript exceptions or failed same-origin requests. Both selected API probes returned HTTP 200 with valid JSON and expected shapes; one external request was deliberately blocked and seven requests canceled during navigation. The earlier lazy-import exception and pending Dashboard render did **not** reproduce in this bounded run. This does **not** prove all interaction flows or persistent reliability. The Mac report/screenshots remain local/private; no API writes occurred.

**SPA navigation:** `navigationMode=spa` with `status=null` is expected because an in-app route change makes no new document HTTP request. Use `rendered`, failed requests and console errors to assess that screen.

Geometry reports include up to 24 text-free tiny-control descriptors (tag/slot/icon, size and location). They exclude raw user text, hrefs and input values. These findings are **diagnostics**, not automatic proof of a WCAG violation.

**27 November — shared tab geometry:** tool source `cc7af6f` adds horizontal tablist/panel overlap detection even when document overflow is zero. The gallery and bounded receipt report affected captures; per-view samples contain only counts, booleans and pixel overflow, not IDs or text. A8 task `pockethost-a8-ux03-testlab-tab-geometry-qa-cc7af6f-20261127-v2`: format, syntax and 20/20 tests across seven Test Lab files PASS. No panel deployment. Browser qualification `pockethost-mac-ux03-shared-tab-detector-browser-cc7af6f-20261127-v2` terminal PASS on verified offline archives: Overview and Source at 390/768/1440px, six before views each flagged one tablist/panel overlap (99/55/11px respectively), six repaired views flagged none. Zero document overflow, JS errors, unlabeled controls or write attempts; one small control on Overview remains diagnostic. Initial v1 expectation incorrectly assumed desktop was unaffected; v2 corrected only the assertion. Images remain local, no real LAN or mutation acceptance.
