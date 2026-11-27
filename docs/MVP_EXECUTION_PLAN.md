---
status: stable
owner: product
last_reviewed: 2026-11-27
purpose: Concise accepted MVP features and evidence boundaries
---

# PocketHost MVP acceptance

**Owner state:** current private-LAN MVP and browser UX accepted for the present stage. **Engineering state:** A8 source G0–G2 PASS at `d2bacd0`; current DEV checkout and UX-05 status are recorded in the [current handoff](HANDOFF_NEXT_CHAT.md). These are deliberately different milestones.

| Area                                  | Established evidence                                                                                    | Boundary                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Admin/dashboard and Local Agent       | Owned A8 panel deployment, diagnostics, scoped UI and HTTP route checks                                 | Do not expose admin publicly                                    |
| SSH and interactive terminal          | Dedicated SSH lifecycle and browser interactive session previously PASS                                 | Keep independently managed SSH services protected               |
| Static Hosting                        | Owned HTML publish, serve/update/rollback and active ZIP export→isolated reimport with matching content | Do not equate API round-trip with every browser ZIP edge case   |
| Trusted Node Hosting                  | Create/stage/deploy/readiness/logs/update/stop/start/rollback PASS on A8                                | Source runs as Termux UID, without untrusted-code isolation     |
| Deployments / logs / hosting overview | Owned project inventory, scoped logs and direct links verified                                          | No claim of public domain/TLS cutover                           |
| Services S1–S4                        | Full fixed-worker owned lifecycle PASS including archive/restore/retire                                 | Arbitrary third-party workers not admitted implicitly           |
| Backups                               | Local encrypted Node Restic snapshot and isolated staging restore of 10/10 files verified               | Not a full-device or off-device disaster-recovery qualification |
| MQTT, health, autostart               | Loopback MQTT and manual diagnostics PASS; 3 boot hooks observed                                        | Actual Android post-reboot recovery not qualified               |
| G0–G2                                 | 486/486 UI, Node 469 PASS / 1 SKIP and 76.11% line coverage                                             | Current release/source SHA remain separate                      |

**Source evidence:** [quality gates](QUALITY_GATES.md), [current handoff](HANDOFF_NEXT_CHAT.md), [hosting and backup acceptance records](MVP_INTEGRATION_CHECKLIST.md), and [21 November device checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md). Older checkpoints are in [Git history](checkpoints/README.md).

## After v1

1. **Repository cleanup and handoff:** maintain a small current documentation tree and unmodified Git ancestry. No production service changes for docs-only maintenance.
2. **Selective upstream evaluation:** compare `himalayladha/termux-hosting-panel` ideas, licenses and tests before implementing feature-bounded replacements. See [reuse strategy](UPSTREAM_REUSE_STRATEGY.md).
3. **Optional later work:** off-device Restic recovery, Android reboot G3, public ingress policy, broader runtimes and stronger isolation. Treat these as new product decisions, not retroactive reasons to fail the accepted private-LAN MVP.

Post-v1 Sprints 1–7 and scoped CF1 implementation/DEV acceptance are closed. Owner confirmed manual public HTTPS reachability; independent public lifecycle/endurance qualification remains deferred. UX-01–UX-07 are the current owner-authorized priority. CF2–CF5 and S8–S12 are not started and follow UX-07; see [Cloudflare roadmap](CLOUDFLARE_ROADMAP.md) and [roadmap](ROADMAP.md). Follow the current owner-authorized UX stage in the roadmap; other deferred scopes retain their approval gates.
