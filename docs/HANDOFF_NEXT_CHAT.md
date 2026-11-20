---
status: active
owner: core
last_reviewed: 2026-11-20
purpose: PocketHost latest A8 DEV source, Lab receipts and bounded resume path
---

# PocketHost — current handoff

Read [AGENTS](../AGENTS.md), [START_HERE](START_HERE.md),
[the MVP tracker](MVP_EXECUTION_PLAN.md), [Test Lab](TEST_LAB.md)
and [Local Agent transport](LOCAL_AGENT_TERMUX.md).
The [18 November checkpoint](checkpoints/2026-11-18-a8-p1-hardening-checkpoint.md)
is historical evidence, **not** the latest live SHA.

## 20 November 2026 — Shared Pi Tunnel UX DEPLOY PASS + Autostart baseline

- Owner selected a **broad working MVP first**, with `photomap.pl` reserved as a **future** independently added complete project; no PhotoMap code, data, DNS, account, or hosting mutation was requested or made.
- PocketHost `main@8f93aa653d12457c0fca5b952a0ac729dea31e79` updates `/services/cloudflare`: visibly distinguishes the **existing remote Pi Zero connector** from the **optional local A8** cloudflared installation, corrects misleading prompts to create A8 credentials/new tunnel, and retains truthful A8-only diagnostics; no backend tunnel control added. A non-activated compatibility-first ingress runbook is committed at [CLOUDFLARE_SHARED_TUNNEL_MVP](CLOUDFLARE_SHARED_TUNNEL_MVP.md), using preserved Pi `http://127.0.0.1:8000` as fallback until the old public hostname is inventoried. No DNS/routes applied.
- Guarded A8 task `pockethost-a8-cloudflare-shared-pi-ui-8f93aa6-deploy-20261120-v1` **DEPLOY PASS**: base `e3cd23c0e73e58c05bf25d9e4f19954f9064b160` → verified live `8f93aa653d12457c0fca5b952a0ac729dea31e79`, owner PID **9990**, start ticks **62675419**, cloudflare page loopback HTTP **200**, protected services **unchanged**, QA **not run**.
- Autostart next-module read-only task `pockethost-a8-autostart-mvp-readonly-inventory-20261120-v1` **done/exit 0** on prior live SHA `e3cd23c0`: Termux:Boot API reports **3 scripts / 3 owner-executable**; independent file inspection confirms 3 local regular scripts, all executable. Local Agent, dedicated SSH, panel, panel-watch and Mosquitto are running, A8 cloudflared intentionally stopped. **Android boot app permission and actual post-reboot behavior unverified**. No script content/credentials returned, no reboot, no scheduler, no service mutations.
- **Next:** finish bounded Autostart startup-chain evidence and then generic independent-project intake. Defer disruptive physical reboot and public app routing to separately approved operational windows. Do **not** install a second tunnel or expose the PocketHost DEV admin HTTP page to WAN.

## 20 November 2026 — Pi Zero existing Cloudflare tunnel integration inspection (READ ONLY)

- Owner asked to **reuse one existing Pi Zero Cloudflare tunnel for A8**, without creating a second tunnel. Read-only via independent **Pi Zero 2 W** Local Agent Git namespace `pi-zero2w-linux` / installation `61bfc921-6445-4501-b215-1a79bb68ca55`; no credentials read into Git result, no tunnel lifecycle changes or route creation.
- Pi task `pi-zero2w-cloudflared-existing-tunnel-readonly-20261120-v1` **done/exit 0**: `cloudflared.service` systemd active PID **668**, cloudflared **2026.10.4**, user's Pi Local Agent active; initial Pi→A8 TCP probes timed out/not reachable. Earlier parser failed to inspect privileged config and missed YAML fields.
- Pi task `pi-zero2w-cloudflared-effective-config-network-readonly-20261120-v1` **failed/exit 1 after producing partial read-only diagnostics**: privileged /etc configuration was readable with noninteractive `sudo -n`, tunnel UUID suffix `aa25b0fe`, same user-home config hash (excluding normalized newline), credentials-file referenced and present. Script error occurred in an unrelated network-IP parsing expression; no mutations.
- Corrected targeted inspection `pi-zero2w-cloudflared-ingress-keys-and-lan-followup-20261120-v1` **done/exit 0**: effective /etc/cloudflared/config.yml top-level keys **`tunnel`, `credentials-file`, `url`**, *no `ingress`*, no `--token` CLI; systemd service uses `--config` and `tunnel run`. Pi IPv4 **192.168.0.23/24**, direct LAN route to A8 **192.168.0.16**, and Pi→A8 TCP **18878/8022 both connected** on fresh check. Last 2-hour system journal sampled 4 registration and 3 disconnect log matches, no routing error match; historical logs are not real-time edge proof.
- Final Pi origin inspection `pi-zero2w-cloudflared-current-origin-readonly-20261120-v1` **done/exit 0**: *existing* tunnel `url` origin is **`http://127.0.0.1:8000` on Pi**, local TCP reachable; it **does not** currently target A8. Pi→A8 18878 and 8022 accessible. Independent A8 Local Agent `pockethost-a8-pi-tunnel-lan-reachability-readonly-20261120-v1` **done/exit 0**: A8 truly binds address **192.168.0.16**, listens on 18878 and 8022, and reaches Pi **192.168.0.23:22**; PocketHost live SHA **`e3cd23c0e73e58c05bf25d9e4f19954f9064b160`**.
- **Design decision / not applied:** keep Pi as the sole cloudflared connector. To add a separately chosen A8 hosted application behind the **same named tunnel**, preserve the Pi origin and convert locally managed single-`url` configuration into hostname-specific `ingress` for the old Pi app and new A8 service, plus configure that new hostname to route to the same tunnel UUID in Cloudflare. Existing hostname and DNS route were **not** inspected, so preserve them before changing the live tunnel. Do not copy Pi config/credentials onto A8 blindly: that would start a **replica**, and `127.0.0.1:8000` would resolve on A8 instead of Pi; replica routing may produce inconsistent responses. Do not publicly expose the unauthenticated PocketHost DEV panel; identify an appropriate A8 application endpoint first. No tunnel restarts, route changes, secrets transferred or WAN exposure.

## 20 November 2026 — Broad MVP: Cloudflare readiness, Mosquitto and core Health checks

**Latest verified PocketHost A8 DEV source: `e3cd23c0e73e58c05bf25d9e4f19954f9064b160`.**
Guarded release task `pockethost-a8-mqtt-runit-ui-e3cd23c-deploy-20261120-v1`: **DEPLOY PASS**, owned PID **22740** / start ticks **62488648**, HTTP **200**, protected services unchanged, tests not run as part of the deployment. Earlier Cloudflare readiness release `20ae7f8199848832d17beea112004ea799ea2724` and core Health release `54647133398231e07a583b5951d51d3bc10b4e9f` each deployed PASS; neither is current live HEAD.

- **Cloudflare**: A8 native inventory `pockethost-a8-cloudflare-mvp-inventory-20261120-v1` found no binary, runit service, config or credentials. Read-only setup UI now identifies installed binary and missing tunnel prerequisites. `cloudflared` **2026.11.1 installed** from local apt candidate; installer task `pockethost-a8-cloudflared-package-install-20261120-v1` intentionally marked FAIL after discovering the package created a runit directory. Independent read-only `pockethost-a8-cloudflared-post-package-service-inspection-20261120-v1` confirms binary available, package service **stopped**, **no config/tunnel** and Agent/SSH unchanged. No public route, Cloudflare account login or token handling; actual edge connection **NOT TESTED / NOT RUNNING**.
- **Mosquitto**: Termux package **2.1.4** installed; initial package service was down. `pockethost-a8-mqtt-loopback-broker-mvp-20261120-v1` **done/exit 0**: saved `run.before-pockethost-mqtt-local-20261120`, configured **127.0.0.1:1883** only in `~/.config/pockethost/mosquitto-local.conf`, runit broker active, **publish → subscribe** delivered matching message, LAN 1883 closed; Agent/SSH unchanged. Explicit loopback-only anonymous access, **not** a public or LAN broker. MQTT user profiles/unrelated services untouched.
- **Health checks**: existing Hosting/worker checks retained. Added manual **Core services** observations (Agent, dedicated SSH, MQTT CONNACK, Cloudflare setup). No background schedule or recovery. MQTT page gained **Check MQTT** button. Fixed runit parser to accept documented suffix `, normally down` alongside semicolon, preventing false UNKNOWN for a running broker.
- **Independent A8 verification** `pockethost-a8-mqtt-health-final-accept-e3cd23c-20261120-v1` **done / exit 0** at **2026-11-20T22:18:30Z**: MQTT diagnostics `runit=running`, MQTT protocol `ready/mqtt-connack`, loopback 1883 available and LAN 1883 unavailable; cloudflared binary available but service stopped; Agent and SSH unchanged; **/services/mqtt, /services/health, /services/cloudflare** returned HTTP 200. Browser button acceptance remains open; on-device API/HTTP evidence is not a browser click receipt.
- **Remaining integration dependency:** a named Cloudflare tunnel requires owner account authentication/configuration, credentials stored on A8 and an explicitly chosen ingress destination. Never invent credentials or expose PocketHost DEV to WAN. Mosquitto LAN exposure, public domains and reboot durability remain outside this MVP's completed scope.

## 20 November 2026 — SSH lifecycle + temporary profile API QA PASS, stage complete

- Owner expressly approved one corrected functional execution on **pinned live PocketHost SHA `8e200b61283b6467d56e268bd1e47fe6a5ba55b6`**, executed **only through Samsung Galaxy A8 Local Agent**. No Mac, external automation, test suite or additional device operations.
- Immutable task `pockethost-a8-ssh-lifecycle-profile-qa-fixed-20261120-v2` on `MichalMatu/local-agent:agent-control`: **done / exit 0** at **2026-11-20T21:46:53Z**. Fixed only overescaped PID parsing in the previous QA task (no application code change). Exact live SHA and owner identity verified before any operations.
- **Profile Add → Update → Delete PASS**, persisted readback, temporary `QA A8 SSH TEMP`/`QA A8 SSH EDIT` deleted. The pre-existing single saved profile remained identical. No terminal session was active or started during QA.
- **Dedicated SSH Restart PASS** (PID 23219 → 8234, port 8022 OPEN), **Stop PASS** (port CLOSED), **Start PASS** (PID 8275, port OPEN). Local Agent PID 6821/start ticks unchanged, STOP absent; other observed protected services unchanged. This confirms the dashboard's **API-backed** lifecycle behavior; it does not claim a browser button click occurred.
- No product defect was observed in this scope, so no source-code correction/deployment was required. The earlier pre-mutation HOLD is historical and superseded by this PASS. Existing owner browser acceptance of terminal login and disconnect is supported separately by screenshots; protected external sshd untouched.

## 20 November 2026 — SSH lifecycle and profile QA attempt HOLD, no mutation

- Owner requested device tests of dedicated SSH Start/Stop/Restart and saved profile Edit/Delete, using only A8 Local Agent. Pinned active PocketHost source `8e200b61283b6467d56e268bd1e47fe6a5ba55b6`.
- Read-only native preflight `pockethost-a8-ssh-control-profile-preflight-20261120-v1` **done / exit 0**: live SHA and process ownership verified; Agent PID 6821, SSH PID 23219 and listener open, one saved profile, no terminal session. One unresolved claim in that snapshot was the executing preflight itself.
- Functional task `pockethost-a8-ssh-lifecycle-profile-qa-20261120-v1` **failed / exit 1 before the first mutation**. The task's PID-parser regex was over-escaped, so its initial `assert agent_state == 'run' and agent_pid is not None` failed in the script precondition (line 62 of stdin). No profile add/edit/delete, no SSH restart/stop/start and no Agent lifecycle operation were executed.
- **HOLD**: leave working SSH and user profile untouched. Do not automatically replay a failed QA task; a corrected one-shot exact-SHA test needs renewed owner approval. The approved functional scope remains not executed.

## 20 November 2026 — dedicated A8 SSH port 8022 recovered, post-restart PASS

- Owner explicitly authorized **restart of `a8-operator-sshd` only**. Used the existing Samsung A8 Local Agent `agent-control` transport; no Mac SSH, no separate scheduler, no unrelated restart.
- Immutable A8 task `pockethost-a8-dedicated-ssh-8022-recovery-20261120-v1` **done / exit 0** (finished 2026-11-20 21:00:55 UTC): exact host identity, sshd config `-t` PASS; prior TCP `192.168.0.16:8022` connection refused (111); one runit restart of the dedicated service; SSH PID **6596 → 23219**, port **8022 OPEN**, Local Agent PID **6821 unchanged** with matching start ticks. No SSH config changes; STOP absent.
- Separate read-only native A8 result `pockethost-a8-dedicated-ssh-8022-post-restart-readback-20261120-v1` **done / exit 0** (21:01:27 UTC): listener remains open, PocketHost `local-agent-operations` API returns `ssh.state=running`, `ssh.pid=23219`, `ssh.listen=open`, `ssh.address=192.168.0.16`, `ssh.port=8022`; Agent PID stays 6821.
- Earlier "listener CLOSED" evidence below is historical and now superseded. No further restarts or QA were run. Owner browser acceptance of SSH terminal/saved profile actions remains open.

## 20 November 2026 — owner screenshot SSH listener CLOSED, independently diagnosed

- Owner's post-deploy screenshots confirm migrated SSH panel and Agent-only overview; the dedicated SSH card reports `running PID 6596` but **`Listener: closed`**. "Other SSH service / sshd" is deliberately a separate protected read-only service and is not evidence about the dedicated listener.
- Read-only A8 Local Agent Git result `pockethost-a8-ssh-listener-readonly-20261120-v1`: **done/0**. Agent PID 6821 and dedicated SSH PID 6596 active under runit; TCP connect to both `192.168.0.16:8022` and `127.0.0.1:8022` returned `ECONNREFUSED (111)`; PocketHost API reports `listen=closed`, HTTP 200. Thus the UI did not invent the warning.
- Follow-up `pockethost-a8-ssh-runtime-rootcause-readonly-20261120-v1`: **done/0**, verified the real `sshd` PID 6596, config `Port 8022 / AddressFamily inet / ListenAddress 192.168.0.16`; Linux TCP tables contained no port-8022 listener. Root cause of missing bound socket **not yet established**.
- **Recovery HOLD:** No SSH restart, config change, Agent lifecycle change or functional QA was performed. The dedicated SSH service needs a separately authorized, isolated recovery, preserving Agent intake, Git task transport and other services. Browser functional sign-off for saved profiles/terminal also remains open.

## 20 November 2026 — A8 SSH page relocation and Local Agent UI refinement DEPLOY PASS

- Owner-requested migration from Local Agent `Control & SSH` into existing `/services/ssh` completed on main `8e200b61283b6467d56e268bd1e47fe6a5ba55b6`.
- Local Agent now shows Agent-only controls and link to Services / SSH. The dedicated SSH listener's Start/Stop/Restart, terminal and saved profiles are rendered together on `/services/ssh`; the separate protected system `sshd` remains read-only lower down, clearly distinguished from the dedicated listener.
- Other scoped UI changes: task durations retain sub-second precision, the raw log supports copy (including legacy clipboard fallback on LAN HTTP) and jump to latest without filtering source lines, delivery status says not checked by panel, and diagnostics more clearly distinguish missing verification evidence from a service failure. No backend controls, SSH configuration or credentials changed.
- A8 read-only preflight `pockethost-a8-ssh-ui-preflight-20261120-v1`: **PASS**; live base `cec1a94`, owner/gateway markers match, Agent PID 6821 and dedicated SSH PID 6596 running at observation.
- Exact-source guarded A8 deployment `pockethost-a8-ssh-ui-relocation-8e200b6-20261120-v1`: **DEPLOY PASS**, live SHA `8e200b61283b6467d56e268bd1e47fe6a5ba55b6`, panel PID **18599** / start ticks **61952882**, loopback `/services/ssh` HTTP **200**, protected services verified unchanged, **tests not run**. No Mac execution, self-update, hardware restart, public exposure or QA.
- Owner browser functional acceptance remains OPEN for the migrated SSH page, connection profiles and terminal; do not treat HTTP 200 as verified button behavior. Unsolicited QA remains off.

## 20 November 2026 — A8 Agent 7415454 production cutover ACCEPTED

- Native source QA `sprint-a8-741-native-qa-clean-source-20261120-v1`: **29/29 tests PASS**, exact candidate bundle **26/26 SHA-256 PASS**, no Agent/SSH service changes during QA.
- One-shot external controller: first `prepare` failed pre-mutation because `operator.py` shadowed stdlib; corrected isolated Python invocation `python3 -I -B` **PREPARE PASS**. `sprint-a8-741-independent-switch-20261120-v1`: **SWITCH PASS**, Agent PID **4112 → 6821**, SSH PID **6596** preserved, rollback baseline stored.
- Independent fresh A8 task `sprint-a8-741-new-runtime-git-accept-20261120-v1`: **done/exit 0**, installed release `7415454b1fb2af7d3babe1c283c9e38848291d2b`, live PID/source, 26/26 manifest, STOP absent and SSH unchanged. Do not replay the switch.
- PocketHost DEV remains at `cec1a94e12a330e89f672f8d4ca1776cc3c7d2e9`, prior deployment HTTP **200**, PID **25941**; this is not browser functional acceptance. **Control & SSH**, Start/Stop, Pause/Resume, saved profiles, terminal and real raw console still need owner browser sign-off. No further tests or panel restarts performed with this docs change.

## Earlier 20 November 2026 — resumed A8 Local Agent + SSH sprint

- **SSH recovered**: native A8 task `sprint-a8-dedicated-ssh-restart-20261120-v1`
  verified port **192.168.0.16:8022 OPEN**, SSH process changed from PID
  4910 to 6596, Agent PID **4112** unchanged. Mac independent strict-SSH
  preflight `sprint-a8-mac-strict-ssh-preflight-741-20261120-v1` PASS
  (private host key pin, exact host identity, old runtime, no STOP, no
  unresolved local claims, 26-file candidate hashes).
- **PocketHost DEV deployed**: `cec1a94e12a330e89f672f8d4ca1776cc3c7d2e9` by
  `sprint-a8-ui-controls-ssh-20261120-v1`, terminal **DEPLOY PASS**
  (owned PID **25941**, start ticks **61554828**, HTTP **200**,
  external services unchanged, **PocketHost QA NOT RUN**).
  `Control & SSH` shows A8 status, local tasks/results, independent
  Start/Stop and (when supported) Pause/Resume, SSH restart, saved profiles
  and a browser ttyd terminal. Browser functional sign-off remains OPEN.
- **Agent release remains at `228489788d1e5c5045904ade95a2c50d791d20c9`**;
  candidate `7415454b1fb2af7d3babe1c283c9e38848291d2b` is present and
  hash-verified, with the owner-requested full raw `[CMD]` emitter plus
  safe intake pause. Independent Mac-native QA task
  `sprint-a8-741-native-qa-clean-source-20261120-v1` is
  **QUEUED / no receipt yet**, so no switch or claim of full emitter
  acceptance. Keep old runtime, STOP absent, rollback intact. Mac status
  reported stale/unverified host-claim state; do not replay the queued QA.
- **P0 owner rule remains:** trusted private LAN; no new authentication,
  token/redaction/security sprint unless explicitly requested.

## 20 November 2026 — owner-requested raw Local Agent console

- A8 PocketHost DEV **DEPLOY PASS** at `8fa67fcbed7d51194246cf86d19f5635205ef3d0`,
  task `pockethost-a8-raw-svlogd-console-8fa67fc-20261120-v1`.
  Guarded exact-source readback: owned PID **17717**, start ticks **60357296**,
  HTTP **200**, protected services unchanged, **tests NOT RUN**.
- The Live console now reads and displays actual binary bytes from the installed
  Termux Agent's fixed `svlogd/current` file. A 256-KiB cursor stream
  reconstructs the entire current file and follows future bytes every 5s,
  including original timestamps, commands and line breaks. No parser,
  categories, sanitization, inferred timestamps or auth tokens.
- Agent source `9ff0befc18cca4e257fab90ed342604c71824a6d` adds opt-in
  Termux-only complete `[CMD]` output and original task IDs. **Source only,
  not yet running on A8:** external Mac SSH task
  `galaxy-a8-raw-command-log-stage-9ff0bef-20261120-v1`
  (candidate package + native QA) is queued; separate operator preparation
  `galaxy-a8-raw-log-operator-baseline-inspection-20261120-v1` queued.
  Never claim the new Agent is installed before independent switch and
  fresh host Git task/result. Prior accepted runtime `2284897` remains live.
- The owner explicitly deferred all new security, authentication, tokens and
  redaction work to a **separate sprint**; follow root AGENTS P0.
  Browser visual/functional sign-off for the new raw console remains open.

## 20 November 2026 — A8 Local Agent log UX deployment

- PocketHost A8 DEV latest **PASS**: `fcbc2734094f41846eea43867d67a922a05a8f8a`,
  immutable A8 task `pockethost-a8-legacy-log-kind-fcbc273-20261120-v1`,
  guarded HTTP **200**, owned PID **10972** / start ticks **59813053**,
  protected services unchanged; **tests NOT RUN**.
- Prior A8 task `pockethost-a8-agent-task-stage-log-342edded-20261120-v1`
  deployed `342edded8f2584e45e7891099538296c02865558` **PASS**,
  HTTP **200**, owned PID **4593** / ticks **59796933**, QA not run.
- Legacy `exec`, `exec finished`, `output summary` now display under
  **Tasks** rather than generic **Service**. New Termux `TASK`, `STAGE`
  and `GIT VERIFIED` records are parsed as structured activity.
- **A8 Agent installed and Git-accepted:** exact runtime source
  `228489788d1e5c5045904ade95a2c50d791d20c9`; 26 native tests PASS,
  independent guarded switch PASS, fresh host Git task/result done/0.
  Independent SSH verified actual TASK/STAGE/GIT VERIFIED records in svlogd.
  Browser console acceptance remains OPEN.
- Historical status only: superseded by the owner-requested raw
  private-LAN console at `8fa67fcbed7d51194246cf86d19f5635205ef3d0`. Browser acceptance remains OPEN.

## Latest verified A8 DEV — Local Agent live log (20 November 2026)

- Task `pockethost-a8-agent-live-log-fb3dcc0-20261120-v1`:
  **DEPLOY PASS** at source `fb3dcc0ed47e006e5ea370ef96854d0b7b6e43c0`,
  exact owned SHA, PID **7894**, start ticks **59625188**, HTTP **200**,
  protected services unchanged; **QA NOT RUN**.
- Local Agent console reads up to 120 recent private svlogd records. Safe Linux
  Core execution fields are reconstructed in order, including command digest,
  exit status, elapsed time and output character count. Unknown/private log
  payloads are masked rather than exposed to unauthenticated LAN clients.
  Browser event-log tail continues visible-page polling every five seconds.
- User browser visual/function sign-off remains **OPEN**; guarded HTTP
  readback does not prove that log entries display correctly in Chrome.
  No lifecycle controls, raw remote command output or public log endpoint.

## Latest verified A8 DEV — 20 November 2026

- Local Agent task `pockethost-a8-local-agent-single-snapshot-b8c5f15-20261120-v1`:
  **DEPLOY PASS** at `b8c5f153db82f1716caa2d62326ffba8fdc79649`,
  guarded readback HTTP **200**, owned PID **27018**, start ticks
  **59407941**, protected services unchanged, **tests NOT RUN**.
- The read-only Local Agent screen and advanced details share one bounded
  control-plane API sample. Opening details no longer issues a duplicate GET.
  Stale diagnostic snapshots and paused browser event updates are labeled.
  UI regression assertions were changed in source but not executed. Owner
  browser acceptance remains open.
- Previous Local Agent UX deployment at `1399087825eb5c5554427ccce3df8d529f3b5c3a`:
  **DEPLOY PASS**, HTTP **200**, PID **27966**, start ticks **59321015**,
  protected services unchanged, tests NOT RUN.

## Verified A8 deployment

- Earlier verified A8 DEV source `83ada7caa6762aec0e0626f6290cfeff583a8fff`,
  task `pockethost-a8-phone-settings-ux-83ada7c-20261120-v1`:
  **DEPLOY PASS**, HTTP **200**, owner PID **24775**, start ticks
  **55819808**, protected services verified unchanged, QA **NOT RUN**.
  Owner screenshot-driven Phone Settings UI improvement: the connection/error
  message is now inside the Display & screen card instead of above it;
  bridge unavailable is labeled "not verified" rather than claiming Shizuku
  is missing; disconnected, unauthorized and settings API errors have
  distinct guidance; previous samples no longer imply live data; brightness
  and screen-timeout controls/labels are aligned with a consistent select
  height/chevron, and descriptions are concise. No Android operations,
  package installations or settings behavior changes. Browser visual
  acceptance remains open.


- Latest verified A8 DEV source: `425ea80155dac58d9f2e47f095a11c077c31f7f8`,
  task `pockethost-a8-shizuku-guarded-actions-425ea80-20261120-v1`:
  **DEPLOY PASS**, loopback HTTP **200**, owner PID **28660**,
  start ticks **55740887**, protected services verified unchanged,
  QA **NOT RUN**, zero Android device commands or package installations.
  UI safety sprint: confirmation prompts before app disable/uninstall/force-stop,
  permission grant/revoke, process TERM and Android service start/stop;
  launch separated from disruptive app controls; stale inventory view-only;
  mutation results trigger fresh bridge and inventory verification; Android
  Shell input/execution/history replay disabled without current authorized
  connection; diagnostics distinguish disconnected, unauthorized and bridge
  API unavailable. Installation is explicitly **unverifiable** from the browser.
  Functionality still requires physical Shizuku/Companion testing; user only
  approved visual UX previously.


- Latest verified A8 DEV live source `1bae685ea9ec69d43b7c2d139562601773581599`,
  task `pockethost-a8-shizuku-search-diagnostics-1bae685-20261120-v1`:
  **DEPLOY PASS**, HTTP **200**, owned PID **27171**, start ticks
  **55646275**, protected services unchanged, QA **NOT RUN**.
  Read-only visual UX update: one icon-bearing Shizuku search field design
  for apps, permissions, processes and services; Diagnostics action moved
  into header; connection status/API checks/native capabilities visually
  separated. No Shizuku installation, Android operation, API behavior change,
  physical QA or browser acceptance. User screenshots showed earlier
  inconsistent search fields and an empty action-button row.


- Latest A8 DEV live source `5c6ccd4bb5c8b43f7ab1563de38d0a7a691fe66a`,
  task `pockethost-a8-centered-root-loading-5c6ccd4-20261120-v1`:
  **DEPLOY PASS**, HTTP **200**, owned PID **32581**, start ticks
  **55572565**, protected services unchanged, QA **NOT RUN**.
  Reviewed screenshots at /settings/appearance: first-load fallback
  positioned the loader at top-left inside the content pane. Corrected
  the shared layout's center alignment, inline spinner geometry, and fallback
  viewport sizing. Reviewed loading patterns across primary PocketHost screens;
  local inventory/operation loaders stay within their sections.
  Browser rendering remains unconfirmed until owner verification.

- Latest verified A8 DEV: `54ea5624c7539d75d5e49cf5791a6bc8a49dfaaf`.
  Task `pockethost-a8-terminal-help-refresh-alignment-54ea562-20261120-v1`:
  **PASS**, HTTP **200**, owned PID **7552**, start ticks **55502910**,
  protected services unchanged, QA **NOT RUN**, no Termux packages installed.
- Scoped UI change: Terminal explains missing `ttyd` only when inventory says absent
  (with link to Packages); otherwise hides dependency/install guidance.
  Top-level Refresh moved to the upper-right on Sites, Network Access,
  Deployments and Projects; Termux pages use a two-column toolbar so
  Refresh remains right-aligned. Backend refresh actions unchanged.
- Browser QA/functional acceptance at this SHA **not performed**.
  Owner will install `ttyd` manually, then use Refresh in the panel.

## Verified A8 deployment

- Latest verified live A8 DEV source: `1444596a94545e4d0cf64e2bab9befbb28fd74e8`.
  Task `pockethost-a8-global-layout-file-1444596-20261120-v1`: **PASS**,
  HTTP **200**, owned PID **19103**, start ticks **55446241**,
  protected services unchanged, tests **NOT RUN**.
- Preceding A8 task `pockethost-a8-dashboard-battery-layout-a51d3e5-20261120-v1`:
  **PASS** at `a51d3e5`; removed transient battery notice from Dashboard
  while retaining the Battery card. Owner confirmed Dashboard stable thereafter.
- Current small UI fixes: stable shared scrollbar gutter and disabled global
  smooth scrolling; shell-shaped first-load fallback instead of a center-only
  spinner; File Manager equal-height bordered columns; explicit `ttyd` absent
  status and Packages installation steps. **ttyd has not been installed**.
- Prior A8 `9bae95a` fixes: initial theme paint; removed external Google Fonts;
  recoverable lazy page load errors; stable Dashboard card slots; Vite asset
  revalidation (API/HTML no-store); File Manager and terminal copy.
- **No browser QA or functional acceptance at `1444596`**. The user has
  reported layout shifting on multiple other pages, so broad browser
  confirmation remains open. Terminal needs a separately authorized package
  install before native Termux Bash can be started. Historical scoped QA
  at `5352c09` does not attest to this newer version.

## Private Mac Test Lab

- Exception to A8-only execution: the paired MacBook Local Agent may run
  **owner-requested, read-only** Chrome screenshots, geometry and allowlisted
  GET probes on the trusted private-LAN panel. Mac never deploys or operates A8,
  executes source/project QA suites or writes panel settings.
- Latest source for this standalone development tool is included in current
  `main`; `scripts/test-lab/capture.mjs` uses one SPA page, isolated Chrome
  context and three viewports, with local-only screenshots and HTML/JSON reports.
- Mac Lab task `pockethost-lab-mac-spa-capture-c762ec3-20261119-v1`:
  **9/9 rendered, zero horizontal overflow and JS exceptions** against A8
  `f8ab416`; host/network GET responses were JSON and minimal shape PASS.
  Follow-up classified-network capture also rendered 9/9. Some other captures
  were incomplete during intermittent LAN/module loading, so no claim of
  universal reliability.
- First real geometry findings: undersized controls in the menu/search toolbar
  and Hosting links/buttons. These motivated `32ea32d` and `5351d88`.
- Post-deploy Mac Lab task `pockethost-lab-mac-vite-timeout-postdeploy-5352c09-20261119-v1`:
  **9/9 rendered views**, zero overflow/tiny targets/JS exceptions/failed
  same-origin requests, both GET API probes HTTP 200 and shape PASS.
  One external request was intentionally blocked and seven canceled.
  The 20-second GET/HEAD-only Vite asset timeout addressed the previously
  observed module import failure in this bounded run, not a universal guarantee.
- API mutation from Test Lab is **not implemented**. Scope-specific owner
  permission, allowlisted endpoint, before-state, independent readback and
  rollback are required before any safe mutation adapter.

## Execution boundaries and next work

1. Read latest `main` and independently check live SHA/owner before each A8 action.
   Source commits and QA receipts are **not** deploy receipts. Avoid racing
   parallel chats: if `main` or QA checkout moved, HOLD and reconcile.
2. Responsive Mac Lab observation after `5352c09` is complete: **9/9 PASS**.
   Next: prioritize authenticated, ownership-scoped, readback-and-rollback
   planning for isolated DEV settings fixture; **no arbitrary API writes**.
   Do not repeat broad A8 UI QA merely to collect errors.
3. Hosting P0 current-browser sign-off, Services S1–S4 owner acceptance,
   Android reboot/autostart G3, WAN/TLS, and off-device recovery remain open
   or deferred. Full G2/G3 has not been certified.

Only A8 handles guarded builds/deployment and on-device QA. No scheduler,
Codex/Work/Actions, unexpected SSH/WAN/Cloudflare changes, foreign-service
adoption, reboot, untrusted Node source or off-device Restic activity.
See [DEV iteration rules](DEV_ITERATION.md) and [quality gates](QUALITY_GATES.md).
