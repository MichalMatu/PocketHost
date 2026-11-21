---
status: active
owner: core
last_reviewed: 2026-11-21
purpose: Minimal PocketHost A8 resume pointer; details in the canonical 21 November checkpoint
---

# PocketHost — current handoff

**Canonical checkpoint:** [21 Nov A8 broad-MVP checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md). **Current acceptance tracker:** [MVP](MVP_EXECUTION_PLAN.md). Read [AGENTS](../AGENTS.md) and [START_HERE](START_HERE.md) first. Older full handoff logs and historical QA/deployment details remain in Git history and in the [18 Nov checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md); do not preload them.

## Current source versus running panel

- **Latest verified PocketHost A8 DEV code:** `76fb23ace36ae01783c7055c79255731e3e79ce5`, receipt `pockethost-a8-qa-remediation-76fb23a-deploy-20261121-v1`: **PASS**, owned PID **18469**, start ticks **68924890**, private loopback HTTP **200**, protected services unchanged, **tests not run**. This confirms the guarded DEV deployment, **not** a fresh QA run.
- **Latest scoped QA (previous SHA `be32b15c`)**: `QA_FAIL` from formatting (11 files), docs index/frontmatter and 3 ESLint imports; structure, boundaries and Markdown lint PASS. Typechecks, Node and UI tests skipped after cheap failures. Commit `76fb23a` addresses lint/docs and a missing heartbeat type import, **not re-tested**. Formatting and the remaining suites are still open; new exact-SHA consent required.
- **Code-quality work since historical 21 Nov checkpoint:** modularized Runit host contracts, worker scripts, inode-pinned attestations, process observations, lifecycle lock, read-only status/autostart and canonical service path checks; separated several large Termux admin UI modules and Static ZIP path diagnostics. This work is deployed up to the pinned SHA above, but specific UI/feature regression QA remains open.
- The 21 November checkpoint records an **earlier historical baseline**. Current live evidence is the task receipt above. Re-read fresh `main` and independently verify A8 live SHA/owner before the next operation; **documentation-only commits after this receipt are not deployed code.**
- Branch audit: `MichalMatu/PocketHost` **only `main`**, **0 open PRs**; no work branch to delete. `MichalMatu/local-agent:agent-control` is a **different, active shared transport repo/branch** and must not be cleaned up as PocketHost noise.
- **This handoff/document cleanup performs no QA, build, deploy, reboot, data backup or site migration.**

## What has working evidence

- **Static:** Create→Publish→Start→HTTP→v2→Rollback previously PASS; **active ZIP download** deployed, **full archive round-trip not tested**.
- **Node:** trusted owner-code lifecycle on A8 previously PASS; no untrusted-code isolation.
- **SSH:** saved profile Add/Edit/Delete and dedicated SSH Restart/Stop/Start **PASS** on pinned SHA; owner Mac SSH interactive terminal + disconnect accepted. Dedicated A8 port **8022**, external system sshd protected.
- **Mosquitto:** **127.0.0.1:1883 only**, publish/subscribe and protocol CONNACK **PASS**; LAN closed.
- **Health / Autostart:** on-demand health and current-service readbacks deployed. **3/3 Termux:Boot scripts executable**, but **no Android reboot acceptance**.
- **Backups:** one scoped encrypted **Node Restic** local backup→staging restore previously PASS; current coverage UI distinguishes rollbacks from backups; no Static/DB/uploads or off-device recovery claim.
- **Cloudflare:** existing named tunnel runs on **Pi Zero**, sole active connector; old Pi origin `http://127.0.0.1:8000`. Pi→A8 LAN verified. A8 optional cloudflared stopped. No DNS, ingress, tunnel, credentials or public traffic changed. [Plan](CLOUDFLARE_SHARED_TUNNEL_MVP.md).
- **Hosting / Services:** one Static and one Node catalog item observed, pages HTTP 200. Existing import implementation should be **reused**, not rewritten; fixed-worker S1–S4 remains `READY_FOR_ACCEPTANCE`.
- **PhotoMap:** `photomap.pl` is the **future** independently imported complete-project acceptance target, **not migrated now**.

## Next bounded sprint

1. **Priority:** verify new **Static active ZIP export → reimport to disposable owned project**, bytes/CRC, safe paths and unchanged original project; requires **fresh exact-SHA manual QA permission**. No speculative test execution.
2. Next, qualify **persistent application uploads/database recovery** on a disposable fixture, without repeating the earlier Node Restic staging PASS. Off-device Restic is **deferred**.
3. Then one generic newly added project with import/deploy/health/logs/update/rollback. Only after this consider Pi's **single shared Cloudflare tunnel** ingress for a separately chosen safe application; existing Pi hostname/DNS not yet inventoried.
4. Reboot/Termux:Boot durability, public HTTPS/auth, Services S1–S4 general cases and full G2 remain separate acceptance work.

## Execution rules

Use **official Samsung A8 Local Agent** for commands/builds/deployments via `MichalMatu/local-agent:agent-control`; task/result path and bounded schema in [runbook](LOCAL_AGENT_TERMUX.md). Only `main` for PocketHost code. Keep one guarded code→deploy→verify at a time; exact SHA, clean checkouts, owner PID/ticks, protected services and HTTP required. **Tests OFF by default; each check category/target SHA needs new approval.** Docs-only writes must **not** launch QA or restart panel. Unknown result = HOLD, not auto-retry. No scheduler, Codex, Work, Actions, unrelated device, public admin exposure, reboot, untrusted Node, destructive restore or off-device data transfer without separate scope.

**Full task IDs, current module matrix, evidence locations and explicit open gates:** [checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md).
