---
status: active
owner: product
last_reviewed: 2026-11-20
purpose: Single concise MVP status, priority and acceptance tracker
---

# PocketHost — MVP execution plan

**Canonical evidence:** [2026-11-18 A8 checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md). This tracker states decisions and remaining work; it is not a release diary. Detailed older device receipts remain in [Hosting integration evidence](MVP_INTEGRATION_CHECKLIST.md), Local Agent Git task-results and Git history.

## Stage status

| Stage                                         | Status                                     | Accepted or verified                                                                                                      | Still open                                                                                            |
| --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A8 DEV platform / inventory / observability   | **Working DEV**                            | Owned panel/runit, private LAN, host inventory, monitoring and navigation; guarded SHA/PID/HTTP readback                  | Not a secure public production panel; boot durability untested                                        |
| Static Hosting P0                             | **DEVICE FLOW PASS; visual MVP accepted**  | Own Create → Publish → Start → LAN HTTP, second release → verified content → rollback                                     | Final current-browser HTTP check, ZIP/folder general import/fault scenarios not fully qualified       |
| Trusted Node Hosting P0                       | **DEVICE FLOW PASS; visual MVP accepted**  | Owner-token protection; Create/Stage/Deploy/HTTP/Logs/Update/Stop/Start/Rollback                                          | Final current-browser readiness/logs review, arbitrary source isolation and WAN prohibited            |
| Deployments / Project logs / Hosting overview | **Visual MVP accepted, targeted QA PASS**  | Owned Static/Node summaries, history, GET-only readiness, deep-link fail-closed and log secret redaction                  | Functional current-browser sign-off postponed                                                         |
| Services S1–S4                                | **READY_FOR_ACCEPTANCE**                   | One full owned fixed-template worker lifecycle with Health/logs/archive/restore/retire                                    | Generic user script/Python, more negative paths, reboot/autostart and owner sign-off                  |
| P1 UI/API safety                              | **Prior scoped PASS; formatting QA FAIL**  | Older Node/Static catalogs, uncertain Create and logs passed scoped QA; newer Boot/Hosting/LAN race fixes deployed safely | A8 QA at `5f1ee2a` failed formatting in 3 files; types and Node/UI tests skipped, full G2 open        |
| Encrypted Node Restic                         | **Local narrow PASS; off-device DEFERRED** | One scoped backup → independent staging restore, 10 matching owned files                                                  | Full-device or Static backups, off-device disaster recovery and browser mutation activation           |
| Platform advanced / Android integration       | **PARTIAL / DEFERRED**                     | LAN gateway settings/readbacks, limited Git/Boot diagnostics                                                              | Reboot persistence, SSH/GitHub write configuration, TLS/WAN policy, Companion/Shizuku, public domains |

**Latest verified DEV update (20 November 2026):** A8 guarded deployment
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
