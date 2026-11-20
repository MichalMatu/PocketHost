---
status: active
owner: product
last_reviewed: 2026-11-20
purpose: Single concise MVP status, priority and acceptance tracker
---

# PocketHost — MVP execution plan

**Canonical evidence:** [2026-11-18 A8 checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md). This tracker states decisions and remaining work; it is not a release diary. Detailed older device receipts remain in [Hosting integration evidence](MVP_INTEGRATION_CHECKLIST.md), Local Agent Git task-results and Git history.

**Current A8 Local Agent and SSH sprint (20 November 2026):** Agent
`7415454b1fb2af7d3babe1c283c9e38848291d2b` is installed and independently
Git-accepted (29/29 source QA, 26/26 manifest checks). PocketHost DEV panel
`8e200b61283b6467d56e268bd1e47fe6a5ba55b6` deployed PASS with owned
PID/start-tick and HTTP 200 readback, protected services unchanged. SSH
controls, saved connections and terminal now live at `/services/ssh`, not
the Local Agent screen. Dedicated SSH listening at `192.168.0.16:8022` was
recovered independently; final lifecycle QA `pockethost-a8-ssh-lifecycle-profile-qa-fixed-20261120-v2`
**PASS** on the exact panel SHA: restart, stop, start and port readback, plus
add/edit/delete of a disposable profile. SSH final PID 8275, Agent PID 6821
unchanged; user's saved profile preserved. Owner screenshots separately
confirmed terminal shell, MacBook SSH authentication and disconnect flow.
No source defect found in this QA scope. External/protected system sshd
remains untouched and read-only. Security hardening remains a separate
owner-deferred sprint.

**Historical A8 log/UI work (20 November 2026):** old panel revisions
`8fa67fc`, `cec1a94` and old Agent versions `2284897` / `9ff0bef`
were earlier steps superseded by the accepted versions above. Their prior
deploy and QA receipts are preserved in Git history and the current handoff;
do not treat their historic pending statuses as the active release state.

**New Cloudflare / MQTT / Health broad-MVP pass (20 November 2026):**
current verified live DEV SHA `e3cd23c0e73e58c05bf25d9e4f19954f9064b160`
(guarded deployment PASS, PID 22740, HTTP 200, unrelated services unchanged).
Cloudflared 2026.11.1 is installed but no authenticated tunnel, credentials or public route
exist, so Cloudflare edge connectivity remains **OPEN**. Mosquitto 2.1.4 is
installed and running strictly on loopback 127.0.0.1:1883; real local
Publish/Subscribe **PASS**. Existing Hosting health checks remain unchanged,
with an added on-demand core-services view and MQTT protocol CONNACK probe.
Independent local-agent receipt `pockethost-a8-mqtt-health-final-accept-e3cd23c-20261120-v1`
**PASS** confirmed MQTT runit running, protocol ready, no LAN listener,
Agent/SSH unchanged and all three module routes HTTP 200.
Browser UI sign-off and Cloudflare account/tunnel integration remain open.

## Stage status

| Stage                                         | Status                                     | Accepted or verified                                                                                                      | Still open                                                                                            |
| --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Cloudflare Tunnel                              | **INSTALLED / SETUP OPEN**                 | cloudflared 2026.11.1 installed and diagnostics deployed; package service stopped safely                                              | Named tunnel credentials, configuration, ingress and edge connection not tested                  |
| Mosquitto MQTT                                 | **LOOPBACK DEVICE MVP PASS**             | Broker installed; 127.0.0.1:1883 only; MQTT publish/subscribe and protocol check PASS                                                | LAN exposure, broker UI lifecycle controls and reboot durability outside current scope           |
| Core service Health checks                     | **DEVICE API PASS / BROWSER OPEN**       | Agent, SSH, MQTT CONNACK and Cloudflare on-demand view deployed; exact-SHA host API evidence PASS, no scheduler                    | Owner browser interaction sign-off and negative-path checks remain open                           |
| A8 DEV platform / inventory / observability   | **Working DEV**                            | Owned panel/runit, private LAN, host inventory, monitoring and navigation; guarded SHA/PID/HTTP readback                  | Not a secure public production panel; boot durability untested                                        |
| Static Hosting P0                             | **DEVICE FLOW PASS; visual MVP accepted**  | Own Create → Publish → Start → LAN HTTP, second release → verified content → rollback                                     | Final current-browser HTTP check, ZIP/folder general import/fault scenarios not fully qualified       |
| Trusted Node Hosting P0                       | **DEVICE FLOW PASS; visual MVP accepted**  | Owner-token protection; Create/Stage/Deploy/HTTP/Logs/Update/Stop/Start/Rollback                                          | Final current-browser readiness/logs review, arbitrary source isolation and WAN prohibited            |
| Deployments / Project logs / Hosting overview | **Visual MVP accepted, targeted QA PASS**  | Owned Static/Node summaries, history, GET-only readiness, deep-link fail-closed and log secret redaction                  | Functional current-browser sign-off postponed                                                         |
| Services S1–S4                                | **READY_FOR_ACCEPTANCE**                   | One full owned fixed-template worker lifecycle with Health/logs/archive/restore/retire                                    | Generic user script/Python, more negative paths, reboot/autostart and owner sign-off                  |
| P1 UI/API safety                              | **Prior scoped PASS; formatting QA FAIL**  | Older Node/Static catalogs, uncertain Create and logs passed scoped QA; newer Boot/Hosting/LAN race fixes deployed safely | A8 QA at `5f1ee2a` failed formatting in 3 files; types and Node/UI tests skipped, full G2 open        |
| Encrypted Node Restic                         | **Local narrow PASS; off-device DEFERRED** | One scoped backup → independent staging restore, 10 matching owned files                                                  | Full-device or Static backups, off-device disaster recovery and browser mutation activation           |
| Platform advanced / Android integration       | **PARTIAL / DEFERRED**                     | LAN gateway settings/readbacks, limited Git/Boot diagnostics                                                              | Reboot persistence, SSH/GitHub write configuration, TLS/WAN policy, Companion/Shizuku, public domains |

**Latest verified A8 Local Agent log change (20 November 2026):**
`fcbc2734094f41846eea43867d67a922a05a8f8a` **DEPLOY PASS**
(owned PID/ticks, HTTP 200, protected services unchanged; QA not run).
Legacy command entries are classed as tasks. A8 Termux Agent source
`228489788d1e5c5045904ade95a2c50d791d20c9` is **native and Git accepted**
(26 tests PASS, independent SSH switch, host Git canary done/0).
TASK/STAGE/GIT VERIFIED entries were confirmed in the real service log;
PocketHost browser visual/functional acceptance remains open.

**Earlier verified DEV update (20 November 2026):** Local Agent live log
deployment `fb3dcc0ed47e006e5ea370ef96854d0b7b6e43c0` **PASS**.
A8 guarded readback: HTTP 200, owned PID/start ticks, protected services
unchanged, QA not run. Console now presents a bounded chronological private
svlogd log tail with safe execution progress fields. Arbitrary log content
and credentials remain masked because the LAN panel has no authentication.
Browser visual/functional acceptance remains open.

**Earlier verified DEV update (20 November 2026):** A8 guarded deployment
`b8c5f153db82f1716caa2d62326ffba8fdc79649` **PASS**
(HTTP 200, owned PID/ticks, protected services unchanged; QA not run).
The Local Agent read-only dashboard now shares one diagnostic snapshot across
overview and advanced details, avoids duplicate API reads, and distinguishes
paused event updates / stale diagnostic evidence. Owner browser acceptance open.

**Earlier verified DEV update (20 November 2026):** A8 guarded deployment
`83ada7caa6762aec0e0626f6290cfeff583a8fff` **PASS**
(HTTP 200, PID/ticks readback, protected services unchanged, no QA).
Phone Settings layout revised: correct bridge status labels, inline card
error, stale sample labeling, aligned brightness/timeout controls.
No changes to Android setting behavior; owner browser acceptance open.

**Earlier verified DEV update (20 November 2026):** A8 guarded deployment
`425ea80155dac58d9f2e47f095a11c077c31f7f8` **PASS**
(HTTP 200, PID/ticks readback, protected services unchanged; no QA).
Shizuku UX safety controls now confirm potentially disruptive actions, disable
Android Shell when unauthorized, and make old inventory view-only until
fresh bridge readback. No Shizuku installation or physical commands. Actual
device effects and browser visual acceptance remain open.

**Earlier verified DEV update (20 November 2026):** A8 guarded UI-only
deployment `1bae685ea9ec69d43b7c2d139562601773581599` **PASS**
(HTTP 200, owned PID/ticks, protected services unchanged, no QA).
Shizuku searches and diagnostics layout unified based on user screenshots.
Shizuku is not installed; physical functionality and browser visual acceptance
remain unverified. No Android behavior or settings changed.

**Earlier verified DEV update (20 November 2026):** A8 guarded deployment
`5c6ccd4bb5c8b43f7ab1563de38d0a7a691fe66a` **PASS** (HTTP 200,
owned PID/ticks attested, protected services unchanged; QA not run).
Shared first-load spinner is now centered inside the content pane; full
browser visual acceptance is still open. Terminal ttk/ttyd is not installed
by this sprint. Older details follow.

**Earlier verified DEV update (20 November 2026):** A8 guarded panel deploy of
`54ea5624c7539d75d5e49cf5791a6bc8a49dfaaf` **PASS**
(HTTP 200, PID/start ticks attested, protected services unchanged, no QA).
Owner confirmed the earlier Dashboard battery-notice fix, then reported
additional loading shifts and unequal File Manager cards. New shared loading
shell/scrollbar stability and matched file-manager borders are deployed but
**await owner browser verification**. Terminal is blocked by missing `ttyd`
(not Companion); package installation requires separate authorization.
Top-right page Refresh alignment and missing-`ttyd` guidance were
subsequently deployed; no package was installed. Browser QA is still open.
Hosting and G2/G3 acceptance remain open.

## Prioritized remaining work

1. **Hosting P0 functional sign-off — OWNER DEFERRED:** Node `Check readiness`, Static site HTTP and project-log selection, bounded screenshot/receipt; `running` alone is not readiness. No repeat of approved visual redesign.
2. **Services S1–S4 final acceptance — OPEN:** verified own worker registration, runit lifecycle, health/recovery, safe negative paths; generic Python/JS execution must remain protected until separately qualified.
3. **P1 maintainability/security:** address observed reproducible stale-state, authorization, logs or API issues in small coherent changes. The earlier P1 QA targets `263d64b`, `5cd0d80`, `e966f74`, `b1fde53` passed only recorded scopes; latest live code `5352c09` has scoped syntax/format/structure/lint/Node QA PASS and the earlier `5351d88` admin TypeScript check PASS; full G2 remains open.
4. **Autostart after Android reboot — NEEDS DISTINCT OWNER AUTHORIZATION:** no physical reboot acceptance; protect Local Agent, panel and hosted apps.
5. **Platform next:** LAN persistence and readback, verified Git/GitHub and SSH settings/keys, stronger admin network protection. No public exposure before threat model and TLS/auth.
6. **Later product work:** ZIP/folder and npm/build edge cases, untrusted process isolation, custom domains/Cloudflare, Python/PHP and optional Companion/Shizuku.
7. **Backlog without date:** [off-device Restic + independent restore](P1_OFF_DEVICE_RESTIC_PLAN.md), explicitly postponed by owner. Do not implement, test or transfer until reactivated.

## Definition of done

- `CODE`: implementation committed to current `main`.
- `DEPLOY PASS`: one terminal verified A8 Local Agent fast-flow receipt proving exact live source, owner PID/ticks, baseline HTTP and protected-service isolation.
- `SCOPED QA PASS`: separate explicit approval + test receipt for the **same exact source SHA and categories**; never implied by deploy or prior runs.
- `DEVICE / OWNER ACCEPTED`: required physical browser/lifecycle evidence and explicit owner decision. `READY_FOR_ACCEPTANCE` is not `ACCEPTED`.

**Standing constraints:** A8 Local Agent exclusively handles source QA, builds and guarded deploys; the paired Mac has a narrow owner-requested read-only Test Lab exception. No default QA, scheduler, auto-retry, unowned services, WAN/SSH/reboot or Restic transfer without separate owner decision. Docs-only changes never deploy. [Full rules](../AGENTS.md) and [quality gates](QUALITY_GATES.md).
