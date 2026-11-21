---
status: active
owner: core
last_reviewed: 2026-11-21
purpose: Minimal PocketHost A8 resume pointer; details in the canonical 21 November checkpoint
---

# PocketHost — current handoff

**Canonical checkpoint:** [21 Nov A8 broad-MVP checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md). **Current acceptance tracker:** [MVP](MVP_EXECUTION_PLAN.md). Read [AGENTS](../AGENTS.md) and [START_HERE](START_HERE.md) first. Older full handoff logs and historical QA/deployment details remain in Git history and in the [18 Nov checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md); do not preload them.

## Current source versus running panel

- **Running A8 DEV code:** `6585afee5a67ce2768be9577fd6a7c173b284668`, guarded receipt `pockethost-a8-autostart-refresh-6585afe-deploy-20261121-v1`: **DEPLOY PASS**, PID **8299**, start ticks **70992303**, loopback HTTP **200**, protected services unchanged. Deployment itself ran no QA.
- **Latest broad changed-scope QA:** terminal A8 receipt `pockethost-a8-qa-closure-6585afe-20261121-v1` is **QA PASS** for `format,structure,boundaries,docs,markdown,root-lint,admin-lint,root-types,admin-types,node,ui,syntax` over 53 changed paths. The earlier six failed UI assertions were fixed; do not mistake this scoped pass for full G2 coverage/build or owner browser sign-off.
- **Later source-only test commit:** `ed1337e9eab4f70f2d393f0339468756b85bf042` adds `tests/quality/site-fleet-zip-reimport.test.mjs`; A8 `node,syntax` **QA PASS**, receipt `pockethost-a8-static-zip-reimport-node-qa-ed1337e-20261121-v1`. The live app remains on `6585afe` because test-only source did not require a panel restart.
- **Live Static ZIP acceptance:** A8 GET exported the active release; strict ZIP validation and import into a temporary independent `SiteFleetHost` project, HTTP byte comparison and original-site no-change checks all **PASS**: 1 file / 432 bytes, 550-byte ZIP, fixture removed. Receipt `pockethost-a8-live-static-export-isolated-import-6585afe-20261121-v1`. This did not create a permanent live site or exercise browser ZIP upload.
- The [21 November checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md) is an **earlier historical baseline**; live source and receipts above take precedence. Check fresh Git `main`, live ownership and protected services before further actions; docs commits do not deploy.
- `MichalMatu/PocketHost` has only `main` and no open PRs at the last branch audit. `MichalMatu/local-agent:agent-control` is a separate active task/result transport branch and must be retained.

## What has working evidence

- **Static:** Create→Publish→Start→HTTP→v2→Rollback previously PASS. Live API ZIP export → strict decode → isolated import/HTTP byte comparison **PASS**, original unchanged, temporary fixture removed. Browser ZIP upload to a newly created persistent site **OPEN**.
- **Node:** trusted owner-code lifecycle on A8 previously PASS; no untrusted-code isolation.
- **SSH:** saved profile Add/Edit/Delete and dedicated SSH Restart/Stop/Start **PASS** on pinned SHA; owner Mac SSH interactive terminal + disconnect accepted. Dedicated A8 port **8022**, external system sshd protected.
- **Mosquitto:** **127.0.0.1:1883 only**, publish/subscribe and protocol CONNACK **PASS**; LAN closed.
- **Health / Autostart:** on-demand health and current-service readbacks deployed. **3/3 Termux:Boot scripts executable**, but **no Android reboot acceptance**.
- **Backups:** one scoped encrypted **Node Restic** local backup→staging restore previously PASS; current coverage UI distinguishes rollbacks from backups; no Static/DB/uploads or off-device recovery claim.
- **Cloudflare:** existing named tunnel runs on **Pi Zero**, sole active connector; old Pi origin `http://127.0.0.1:8000`. Pi→A8 LAN verified. A8 optional cloudflared stopped. No DNS, ingress, tunnel, credentials or public traffic changed. [Plan](CLOUDFLARE_SHARED_TUNNEL_MVP.md).
- **Hosting / Services:** one Static and one Node catalog item observed, pages HTTP 200. Existing import implementation should be **reused**, not rewritten; fixed-worker S1–S4 remains `READY_FOR_ACCEPTANCE`.
- **PhotoMap:** `photomap.pl` is the **future** independently imported complete-project acceptance target, **not migrated now**.

## Next bounded sprint

1. **Persistent application data recovery (next):** map project-owned uploads/database/state and demonstrate backup → isolated staging restore on a disposable fixture. Earlier encrypted Node Restic proof is already PASS; do not repeat without a specific reason. Off-device Restic stays deferred.
2. **Finish browser Static upload acceptance:** real ZIP export/isolated reimport is PASS; independently exercise the existing browser upload flow on a newly created disposable owned project **only with verified cleanup and explicit scope**. No live user project replacement.
3. **One generic independent project:** import/deploy/health/logs/update/rollback and retain data; only then consider Pi's **single shared Cloudflare tunnel** ingress for a safe app. Existing Pi hostname/DNS remain untouched.
4. Reboot/Termux:Boot durability, public HTTPS/auth, Services S1–S4 general cases and full G2 remain separate acceptance work.

## Execution rules

Use **official Samsung A8 Local Agent** for commands/builds/deployments via `MichalMatu/local-agent:agent-control`; task/result path and bounded schema in [runbook](LOCAL_AGENT_TERMUX.md). Only `main` for PocketHost code. Keep one guarded code→deploy→verify at a time; exact SHA, clean checkouts, owner PID/ticks, protected services and HTTP required. **Tests OFF by default; each check category/target SHA needs new approval.** Docs-only writes must **not** launch QA or restart panel. Unknown result = HOLD, not auto-retry. No scheduler, Codex, Work, Actions, unrelated device, public admin exposure, reboot, untrusted Node, destructive restore or off-device data transfer without separate scope.

**Full current task IDs and open gates:** this handoff and the [MVP tracker](MVP_EXECUTION_PLAN.md). The [21 November checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md) preserves the earlier historical baseline.
