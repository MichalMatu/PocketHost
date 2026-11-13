---
status: open-device-acceptance
owner: hosting
last_reviewed: 2026-11-13
purpose: Compact current Node Hosting UI preview and next-chat evidence handoff
---

# PocketHost — Node Hosting panel visual checkpoint

## Source boundary

- Code source before documentation: `b7c8caffd8713b42334e991e5dd9df7e7b2e4043`.
  The documentation commit moves `main`; re-read HEAD before edits or tests.
- Existing PocketHost page: `/projects` within the DEV-only Vite admin panel.
  Historical trusted-LAN address: `http://192.168.0.100:18878/projects`.
  **Reachability, running version, and owner-visible UI are NOT confirmed today.**
- GitHub commit ≠ Samsung checkout ≠ running Vite process. No live screenshot
  or owner browser acceptance from this session. Do not present a mockup
  as evidence of the installed interface.

## Features in current source

- PocketHost-owned Node project creation, staged releases and source integrity.
- Pinned public GitHub import and update review (requires root
  `package.json`, `package-lock.json`, `server.mjs`; start script fixed).
- Bounded frontend text and binary assets, local whole-folder selection,
  staged source restore and revision checks.
- Explicit npm dependency and build approvals; artifact proof / file preview.
- Runtime planning, loopback readiness, logs, explicit deploy/start/stop/restart
  and read-only rollback feasibility. No automatic public deployment.

The current implementation supports restricted buildable apps, **not arbitrary
AI-generated websites**. `dist` is not automatically served: the owned
`server.mjs` must serve it. The npm build workspace copies files but is not
a separate operating-system security sandbox.

## Native evidence / uncertainty

| Source tested | Terminal evidence | Classification |
| --- | --- | --- |
| `d1aba6c` | 19/19 focused Node tests and root TypeScript | PASS, historic scope |
| `ea24a4f` | 7/7 build tests, focused UI and TypeScript | PASS, historic scope |
| `40a8513` | 61/61 Node tests and UI pass; TypeScript failed | HOLD, repaired after |
| `00f50c6` | 18/18 source tests pass; root TypeScript failed | HOLD, repaired after |
| `631ed7c` | 40/42 tests pass; two rejection-message assertions failed | HOLD, assertions repaired |
| Newer local-folder/import work | Focused Samsung jobs published; terminal reports absent | PENDING / HOLD |
| Current full code source | No exact-SHA terminal PASS and no visual screenshot | UNVERIFIED |
| Real disposable Node G3 | No approved physical end-to-end deployment | OPEN |

There is no evidence of a successful 2026-11-13 panel refresh to the latest
source. The earlier runit-backed panel and private LAN route were accepted
on **older** code; don't extrapolate their installed SHA.

## Smallest next session

1. Fresh `main` HEAD; read `AGENTS.md`, `docs/START_HERE.md`,
   `docs/LOCAL_AGENT_TERMUX.md`, and this checkpoint.
2. Retrieve the pending local-folder/browser-test receipts **once**;
   don't enqueue duplicates. Correct confirmed failures, then one bounded
   exact-source Samsung check of affected files and TypeScript.
3. Read-only inspect running PocketHost panel owner, checkout SHA, effective
   Node feature flags and `/projects` route. Existing LAN URL is historical;
   network ownership must be confirmed, never inferred by port alone.
4. After approved, guarded **PocketHost-only** synchronization (manual review
   required for `vite.config.ts` and host modules), reuse existing Vite process
   / HMR. Capture a real browser screenshot and have owner inspect:
   GitHub import, local folder, source/asset inventories, build and rollback
   controls; no foreign service changes.
5. Only then, with separate owner approval, test a disposable owned Node
   service end to end. Keep static H2, IleStoi, PhotoMap, Local Agent, SSH,
   Cloudflare and other existing services untouched.

No Codex, Work, GitHub Actions, second test checkout, silent installs,
public tunnels or false G3 PASS. The next chat should proceed to practical
browser QA, not another broad repository audit.
