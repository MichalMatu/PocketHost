---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-07
purpose: Single current PocketHost entrypoint with exact native evidence and release holds
---

# PocketHost — next chat handoff

## Verified source and execution

Repository: `MichalMatu/PocketHost`. Continue on fresh `main` only.
The latest **fully native-tested application source** is
`bc5e5539ca4656e59077335b71c0875f967ea859` (2026-11-07).
Documentation updates after that commit do not automatically inherit a new
same-SHA QA receipt. Verify the new HEAD and changed paths before work.
The isolated Samsung QA checkout was clean after its exact-source test.

All project execution, tests, builds and dependency work are restricted to the
verified Samsung Termux Local Agent through the private `agent-control` transport.
Use [the Local Agent runbook](LOCAL_AGENT_TERMUX.md) to verify the live installation;
an old host ID or receipt is not proof of current liveness. Do not use
GitHub Actions, Codex, ChatGPT Work, Mac/sandbox PocketHost execution, a new
branch or force push.

## What is accepted

- **P0–P2:** foundation, read-only host inventory and admin baseline.
- **P3 code and native runtime:** explicit PocketHost-owned demo, guarded
  Start/Stop/Publish/Rollback, typed read-only APIs and native UI component tests.
- **P4 catalog:** stopped imported PhotoMap TEST snapshot, versioned read-only
  metadata and isolated copied workset. PhotoMap live runtime is **disabled**.
- **2026-11-07 native quality:** `pockethost-claim-final-clean-native-gate-bc5e55-20261107-v1`
  returned `done/0`: `npm run check:all` passed with **101/101 Node**
  and **16/16 Vitest** tests, plus formatting, Markdownlint, lint, TypeScript,
  coverage floor and Vite build. Coverage: **80.34% lines, 84.30% branches,
  79.88% functions**. PhotoMap port 8010 was closed.
- **Real owned P3 loopback operations:** task
  `pockethost-p3-owned-live-reversible-api-acceptance-20261107-v1`
  returned `done/0`. It verified Publish v1 from v2, Rollback to v2,
  Stop and Start, real HTTP content, and unchanged state of six monitored
  foreign services. The owned demo finished running on loopback with v2.

The full source/test breakdown, task IDs and explicit limitations are in the
[final native checkpoint](checkpoints/2026-11-07-final-native-qa-handoff.md).
Historical intermediate failures remain in the [checkpoint archive](checkpoints/README.md);
do not repeat already accepted identical-SHA gates merely to regenerate evidence.

## Release HOLD — not finished

1. **P3 browser:** a real Chromium render attempt timed out (exit 124).
   No actual browser Publish/Rollback clicks, keyboard/ARIA or accessibility
   acceptance exists. jsdom/Vitest and HTTP operations do not replace it.
2. **PRoot safety:** source tests now refuse forged identities, PID reuse,
   unverified descendants and uncertain `start.claim`; however detached/
   reparented orphan recovery, uncertain spawn and complete physical Stop
   and rollback remain unproven.
3. **PhotoMap:** live Start/health/Stop, real safe recovery and full
   source/SQLite/media restoration have **no approval or hardware acceptance**.
   The imported original and all foreign services must stay untouched.
4. **Knip:** v5/v6 cannot currently load the native `oxc-resolver` dependency
   under Termux. This is a tooling limitation, not evidence of dead code.
   Do not prune dependencies or preserved upstream screens based on it.

No public ingress, autostart, package upgrades, unrestricted shell/AI API or
production release is authorized. Do not turn source test success into service
activation.

## Next bounded sprint

1. Perform fresh read-only host/checkout/foreign-service preflight.
2. Solve the **P3 real-browser interaction gate** using a verified safe
   Termux-compatible driver or manual device evidence; do not touch existing
   occupied ports or other services. Capture actual click, keyboard,
   version-selection and error paths with pre/post foreign-service state.
3. Continue **PRoot orphan/unknown-claim recovery** with negative fixtures,
   an explicit recovery plan and independent hardware evidence. Never
   auto-kill unknown PIDs, force-delete claims or enable PhotoMap as a shortcut.
4. Evaluate a compatible Knip baseline and targeted browser accessibility
   tooling without changing the device package estate blindly.
5. Request **separate explicit owner authorization** before any controlled
   PhotoMap run against disposable copied data. Full restoration acceptance
   is a separate gate.

Keep the [development plan](DEVELOPMENT_PLAN.md), [quality contract](QUALITY_GATES.md)
and this handoff synchronized. Preserve historical receipts; close only
demonstrably accepted work.
