---
status: checkpoint
owner: core
last_reviewed: 2026-11-17
purpose: Static Hosting MVP acceptance and next-chat A8 Local Agent resumption
---

# PocketHost — 2026-11-17 checkpoint and Local Agent handoff

## Verified release and operating mode

- Repository: `MichalMatu/PocketHost`, branch `main`; at handoff preparation source HEAD `02b21f5673826c642de01711625cbe4a34b6fc1e`. Re-read current HEAD before any new source write.
- Executor: existing paired **Samsung Galaxy A8 official Termux Local Agent**, controlled through GitHub Connector with private `MichalMatu/local-agent` repository, `agent-control` branch. Do not use Mac, S22, Codex, Work or GitHub Actions.
- Last guarded live panel source: `79be0852cb204b535bfc0ce8a42a78aaf92330ea`. Panel PID 22154, start ticks 28334582, HTTP 200; protected services unchanged; free 15.72 GiB.
- Exact immutable A8 result: `pockethost-a8-hosting-metrics-format-fast-flow-20261117-v1` — done, exit 0, nested guarded FAST FLOW PASS, deployment applied, tests not run. A docs-only HEAD newer than this source is expected; never redeploy merely to synchronize documentation.

## User-verified static site MVP — PASS (2026-11-17)

- Owner created and started PocketHost-owned static website `first website`, ID `site-33cca1ef73fd4bd89b41d979b754ccfe`.
- One immutable HTML release `r-22ad782ce6ef40489494a293ed87669b`; one file, 432 B displayed.
- Owner's browser screenshot confirms actual HTML rendered over trusted LAN at `http://192.168.0.16:18879/h2/site-33cca1ef73fd4bd89b41d979b754ccfe/` and manual panel `HTTP: healthy`.
- Hosted site's verified child PID was 6619, process start ticks 28281046. This is **different** from the PocketHost panel PID. Latest screenshot shows memory 56.4 MiB and uptime 14m 9s. These are observations, not static expected values.
- Accepted: Create → Publish HTML → Start → private LAN render → manual Verify HTTP. The static editor, deployment/version readback and memory/uptime display improvements are visible.
- **Not accepted:** ZIP/folder import, update to second release, exact served-content verification after rollback, stop/restart failures, physical reboot/Termux:Boot and public exposure. No WAN/TLS/login claim.

## Preserve working capabilities

- `/hosting`: static vs Node.js entry; `/sites`: owned site creation, HTML starter, ZIP/folder, release history, start/stop, health, logs, rollback, LAN preview.
- Frontend `apps/admin/src/app/sites/page.tsx`; byte units `apps/admin/src/lib/format-memory.ts`; uptime `apps/admin/src/lib/format-uptime.ts`; site API in `apps/admin/vite.config.ts`; DEV feature flags in `ops/termux/panel-service.sh`.
- Services S1–S4 fixed-worker implementation frozen at READY_FOR_ACCEPTANCE, not full ACCEPTED. Platform/Boot and Backup/Restore gaps deferred. Do not resume repetitive Services audits.
- Node backend source/runtime mutations from passwordless LAN are deliberately blocked. Do not remove the LAN proxy security boundary or enable arbitrary backend execution just to make an action appear available.

## New chat: execute using Local Agent

1. Read fresh `AGENTS.md`, `docs/START_HERE.md`, `docs/MVP_EXECUTION_PLAN.md`, `docs/HANDOFF_NEXT_CHAT.md`, `docs/LOCAL_AGENT_TERMUX.md`, and **this checkpoint**. Inspect current main HEAD and latest verified live panel source separately.
2. In the private Local Agent `agent-control` transport, validate the existing Samsung A8 host and installation identity from a prior verified task/result. Never guess an ID, choose Mac/S22, or reuse an old task ID.
3. For each substantial code increment use **one** GitHub main commit → **one** immutable A8 Local Agent task running guarded `ops/termux/fast-flow.mjs --base=<verified-live> --target=<new-code-SHA> --apply` → independently check terminal PASS/HOLD, live SHA, panel PID/start ticks, HTTP and protected services. Missing receipt/HOLD: stop, no automatic retry. Documentation-only commits need no task, restart or QA.
4. **No scheduler**, background automation, Actions, reboot, SSH/WAN, unrelated process changes or agent self-update. Do not modify/delete the existing static site.
5. Tests/lint/typecheck/format/smoke remain OFF unless the owner freshly approves a precise SHA and test scope. Historical QA PASS on `c0bf0218` and prior UI FAIL on `c1c2ef8c` do not cover the current source.

## Next goal: Node.js Hosting with backend

1. Design safe owner approval/authentication for modifying Node.js source from the MacBook LAN UI. Existing LAN security checks cannot be bypassed with a spoofable header.
2. Reuse existing `/projects` and Node project/release/runit modules. Build the simplest end-to-end path: create/import owned Node project → review source and dependencies → prepare immutable release → authorize one deploy/start → private LAN HTTP readiness → logs → update/rollback.
3. When appropriate, finish static update/rollback on the **existing owned test site** with explicit manual approval and independent content/readback. Preserve all user data.
4. Defer Platform reboot/Boot, SSH/Git controls and full Backup/Restore until separately authorized. Focus on shipping useful Hosting features rather than micro-hardening Services.

**Resume instruction:** Continue `MichalMatu/PocketHost` with GitHub Connector + Samsung A8 Termux Local Agent. Static basic MVP is owner-confirmed PASS. Focus Node.js backend Hosting and secure MacBook LAN publish workflow. Preserve the current static site and operational guardrails; no scheduler, unrelated services, repeat audits or automatic retries.
