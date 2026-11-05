---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Evaluate agentic quality tools and their Termux compatibility
---

# Tooling Evaluation — Agentic Development on Termux

## Rule: execution happens on the phone

All PocketHost code/dependency/build/test execution runs on the existing Termux host through Local Agent **host commands**, not via project binding. GitHub Connector manages source and the existing private task transport. A GitHub README or npm package listing cannot establish that a tool is installed or usable on the phone. Do not run Mac/sandbox fallbacks, global package installation, `pkg upgrade` or implicit system changes. Pin dependency versions and lockfile after a scoped on-device trial.

## Recommended layers (adoption is conditional)

| Phase | Candidate and source | Purpose | Status |
| --- | --- | --- | --- |
| P0 | [TypeScript](https://github.com/microsoft/TypeScript), [ESLint](https://github.com/eslint/eslint), [Prettier](https://github.com/prettier/prettier) | Type, lint and formatting gates | Configured; full native check pending |
| P0 | [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2), repo custom checks | Markdown links, structure, module architecture | Configured; current native receipt pending |
| P1 | [Vitest](https://github.com/vitest-dev/vitest) | Typed module and fake host-adapter tests | Proposed; require native Vite compatibility |
| P1 | [Knip](https://github.com/webpro-nl/knip) | Detect dead files, exports and dependencies | Proposed |
| P1 GUI | [shadcn/ui](https://github.com/shadcn-ui/ui), [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) v4, [@shadcn/lint](https://github.com/shadcn-ui/lint) | Reuse fixed components, enforce styling and token contracts | Selected direction; native install/build pending |
| P1 GUI | [Style Dictionary](https://github.com/style-dictionary/style-dictionary) + [DTCG token schema](https://github.com/design-tokens/community-group) | Generate CSS variables from single token source | Proposed |
| P1 GUI | [Stylelint](https://github.com/stylelint/stylelint) + project CSS token policies | Catch direct CSS deviations missed by JSX lint | Proposed |
| P1 GUI | [axe-core](https://github.com/dequelabs/axe-core) | Browser accessibility audit | Requires compatible on-device browser driver |
| P2 | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | Advanced dependency boundaries | Optional after existing gates |
| P2 | [Storybook](https://github.com/storybookjs/storybook) | Component/variant state gallery | Optional; memory and bundle weight |
| P2 | [OpenVisio](https://github.com/syntaxPriest/openvisio-oss) | Local agent code graph and ranked context | Optional; **Termux compatibility unverified** |

Ruff is not appropriate for the TypeScript-first PocketHost application unless Python source is introduced.

## Reusable admin dashboards versus full CMS

The uploaded reference resembles [ShadcnStore's MIT-licensed React/Vite dashboard](https://github.com/shadcnstore/shadcn-dashboard-landing-template). This is an **admin UI template**, not a CMS. It provides a sidebar, navigation, tables, charts, forms, settings, dashboards and component structure. Prefer auditing/reusing the Vite version, not bringing in its entire demo/landing feature set. Its v2 release uses Base UI/base-nova; do not combine blindly with the previously proposed maia/Radix variant. Keep exact upstream attribution and license.

Alternatives: [official shadcn dashboard-01](https://ui.shadcn.com/blocks) for a smaller shell, [shadcn-admin](https://github.com/satnaing/shadcn-admin) for a different Vite dashboard, and [Refine](https://github.com/refinedev/refine) only when many generic data CRUD workflows justify another framework layer.

CMS platforms such as [Payload](https://github.com/payloadcms/payload), [Strapi](https://github.com/strapi/strapi) and [Directus](https://github.com/directus/directus) manage content collections, not Termux processes, packages or ownership. They introduce databases, additional services and potential native build or Docker/runtime dependencies. Do **not** adopt a CMS as PocketHost's control plane; a per-website CMS can be optional later. No CMS compatibility with Android/Termux has been qualified.

## Findings: OpenVisio

OpenVisio is a real open-source project (different from Intel OpenVINO). The npm CLI + MCP server indexes symbols, imports and call graphs with tree-sitter, exports a code graph and provides a ranked repository skeleton. Upstream's `mcp/README.md` states **Node >=18.17**. Its `core/package.json` depends on `lmdb` and `web-tree-sitter`; LMDB includes native bindings. Android/Termux support and prebuilt binary availability were **not verified** on the actual device. An isolated native install/build is needed before using it as a gate; do not block early MVP on OpenVisio.

The existing host-command workflow does not automatically expose a local MCP server to ChatGPT. `openvisio skeleton`/`export` may be a more practical initial interface than `openvisio init` (which writes editor/MCP config). Do not claim the upstream benchmark token-savings figures as PocketHost measurements.

## Native Android browser / visuals

[Termux:GUI](https://github.com/termux/termux-gui) provides a separate Android plugin with native controls and WebView but is not needed for a browser-hosted PWA MVP. A localhost dashboard can be displayed in an ordinary Android browser and later wrapped in an APK.

Standard Linux Playwright Chromium downloads do not establish working Termux/Android compatibility. Treat any WebView/CDP or browser-automation GitHub project as experimental until reviewed, scoped, and tested on this device with no impact to IleStoi.pl. Pin screenshots to exact phone/browser, viewport, fonts, theme, test data and reduced motion; compare to reviewed baseline (pixel/perceptual threshold); capture accessibility tree, interaction and responsive behavior separately. If no driver is accepted, report visual tests as **unverified** rather than relying on lint.

## Staged tooling qualification

1. Read-only identify native Node, npm, Git, CPU ABI and tool availability through the host-command Agent lane.
2. Confirm a clean, independent PocketHost ordinary Git checkout (no project binding).
3. Run existing foundation gates on device and record source SHA, task/result, exit codes.
4. Generate/review a lockfile on Termux; run full existing lint/format/type/docs gate there.
5. Trial Vite/React/Tailwind/shadcn and `@shadcn/lint` on disposable test source; require both allowed-component PASS and deliberately forbidden-style FAIL.
6. Add token generation + deterministic drift detection; later qualify visual and accessibility testing against real browser.
7. Trial OpenVisio **separately**, only if its native dependencies install without disruptive changes.

All statuses remain **proposed** until an actual on-phone Local Agent task result confirms them.
