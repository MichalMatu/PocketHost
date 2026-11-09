---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-09
purpose: Canonical PocketHost code, repository structure, quality, live panel recovery and next-chat handoff checkpoint
---

# PocketHost — code, quality, structure, and next-chat checkpoint

## Scope and authority

**Snapshot taken on 2026-11-09.** Repository:
`MichalMatu/PocketHost`, **main only**. Verified source HEAD before
publication of this checkpoint:
`55662f4fca08b4736fcd49ca629f8f3337708fb8`. Re-read the fresh
HEAD in the next chat; the checkpoint commit itself advances it.
Do not assume that the on-device live checkout has the same SHA.

Development and native source tests run only on the designated Samsung
SM-S906B Termux Local Agent; Mac Local Agent was used for SSH, Android
transport and guarded physical service verification. GitHub Connector
is for source/doc edits and immutable task/receipt transport. Do not
query or run GitHub Actions and do not switch to other execution modes.

This is an **evidence checkpoint**, not a declaration that the entire
application, all Android controls, all historical QA gates or a reboot
recovery are fully accepted.

## 1. Deployed panel / latest verified physical evidence

**Accepted host acceptance — PASS.**

- Phone: Samsung SM-S906B with Termux, LAN address observed as
  `192.168.0.100` at acceptance. SSH `8022` accessible from Mac via
  pre-authorized `host_ops_termux_ed25519` identity; do not commit or
  disclose private keys.
- Existing Termux `runsvdir` manages exactly two new isolated
  PocketHost services: `pockethost-panel` and
  `pockethost-panel-watch`. No second Termux manager or boot hook.
- PocketHost loopback Vite `http://127.0.0.1:8787/shizuku`:
  **HTTP 200**. Existing Wi-Fi gateway
  `http://192.168.0.100:18878/shizuku`: **HTTP 200**.
  Mac directly verified HTTP 200 after the recovery test.
- Guarded activation: `pockethost-panel` PID `15757`,
  watchdog PID `16103`, service states `run`.
- Controlled **panel-only** `sv term` test: recovered under
  `runit` as new panel PID `22800`; both loopback and private LAN
  returned HTTP 200 within the observed **6-second bound**.
- Six protected services unchanged before/after:
  `sshd`, `cloudflared`, `wreckscanner`,
  `mosquitto`, `ilestoi-healthwatch`,
  `termux-agent`. Other hosted sites were not restarted.
- Verified live DEV code at initial activation:
  `2d9cab21f14ff14f14704bc0d1d1b26eb7d98528`.
  The later GitHub documentation and installer changes are **not
  automatically live** merely because they were committed.

Evidence in private `MichalMatu/local-agent@agent-control`:
`pockethost-panel-activate-after-runsvdir-20261109-v1`
(done/PASS) and `pockethost-panel-mac-hardware-recovery-20261109-v1`
(done/PASS; phone owner PID change, LAN 200 and Mac HTTP 200).
The first native installer task
`pockethost-panel-native-guarded-runit-install-20261109-gpt6-v1`
failed safely before activation because the service manager had not
yet created `supervise/ok`; it is **superseded**, not evidence of a
continuing outage.

The root cause of the observed Mac/browser outage was **absent panel
listeners**, not Chrome, Wi-Fi or SSH. The installer now waits for
`runsvdir` to adopt both service definitions before enabling them.

**Not yet accepted:** a real full-phone/Termux:Boot reboot;
long-lived watchdog hang/flapping/Android force-stop acceptance;
a fresh after-handoff phone status sample if processes have changed.

## 2. Source implementation and architecture inventory

Verified GitHub tree at snapshot: **534 tracked file blobs** out of
669 tree entries; about 299 `.ts/.tsx`, 54 `.mjs`, 108 `.md`,
5 Java source files and 55 test files (Node/Vitest).
The repository contains 10 declared source modules:

- `host`: Termux process/service adapters, LAN gateway, ownership
  and Shizuku transport; its host-scoped scripts are explicit.
- `runtime`, `sites`: existing H2 owned static-site runtime,
  release/rollback, processes and guarded lifecycle.
- `inventory`, `packages`, `observability`,
  `diagnostics`: inspection and diagnostics.
- `config`, `ai`: current contracts/foundations, not proof of
  working advanced management/API.
- `shizuku`: Android power-user contracts and native Companion
  integration. Do not interpret a module name as a fully accepted
  Android operation matrix.

Additional code: `apps/admin` (Vite/React GUI, historical upstream
screens and project routes);
`native/pockethost-companion` (Java/Gradle Android bridge);
`ops/termux` (runit panel/watchdog);
`scripts/quality`, `tests/quality`, `apps/admin/tests`;
documentation, ADRs and checkpoint archive.

**Current vs target architecture:** source today is a transitional
mixture of existing H2 static Hosting, legacy single-demo/PhotoMap
adapters, Termux administration, Shizuku and older UI navigation.
The approved design is **PocketHost = modular platform, Hosting =
orchestrator of modules**, with top-level areas Dashboard, Hosting,
Modules, Termux/System, Android & Shizuku, Automation and Platform.
This target is **not yet implemented**. See
[roadmap](../ROADMAP.md),
[module model](../MODULES.md) and
[target information architecture](../TARGET_INFORMATION_ARCHITECTURE.md).

**Upstream-first reuse:** the latest architecture additionally prefers
official installed Termux CLI tools, including existing runit,
Termux:Boot, pkg, Restic, cloudflared and optional ttyd/PRoot,
behind narrow host adapters. The
[upstream reuse strategy](../UPSTREAM_REUSE_STRATEGY.md) is
evaluation guidance, **not authorization to install packages, copy
licenses or migrate the running workloads**. Do not create a
second supervisor or backup engine.

Target contracts: `ModuleRegistry`, `ServiceRegistry`,
`ProjectRegistry` with versioned `components[]`;
shared `SupervisorAdapter`, `DependencyPlan`,
`HealthPolicy`, `SecretRef`, `BackupPolicy` and release gates.
Hosting must manage **only projects created within PocketHost**.
IleStoi, PhotoMap and Local Agent remain external and must not be
auto-imported, adopted, restarted or migrated by discovery.

## 3. Code and quality evidence (truthful matrix)

| Area | Result and exact scope |
| --- | --- |
| PocketHost runit shell/Node syntax | PASS on native S22, `2d9cab21`; repeated at `7521ca5` |
| Panel runit negative tests | **3/3 PASS**, native S22 at `2d9cab21` and `7521ca5` |
| Physical `runit` activation, protected-service invariant | **PASS** for installed panel, recorded above |
| Controlled panel-only restart + Mac HTTP | **PASS** with old/new PIDs `15757`/`22800`, HTTP 200 |
| Full device reboot / Android force-stop recovery | **OPEN — never run/accepted** |
| `npm run check:structure` at `2d9cab21` | **FAIL**: manifest omitted `native`, `ops`, `shizuku` and six host ESM/declaration files |
| `npm run check:docs` at `7521ca5` | **FAIL**: five archive entries absent and one incorrect Shizuku relative link |
| Later structure source fixes | **PASS** at d284491 (S22 receipt); docs headings fixed after this test |
| Full `npm run check:all`, coverage, UI matrix on latest code | **OPEN**, older passing results do not transfer to newer SHA |
| Shizuku P0/P1 advanced action matrix | **OPEN for current combined source**; earlier accepted direct shell remains historical evidence |
| Native Companion matching current main | **OPEN** unless independently rebuilt/installed/tested |
| H3.4 Restic/ttyd physical regression and owned project data restore | **OPEN** per previous independent checkpoints |
| UI full target navigation and Node Hosting MVP | **DESIGN**, not a deployed feature |

**Changes committed in this checkpoint preparation:**

1. Registered `native`, `ops` and `shizuku` in
   `project.structure.json`; exact host-only Android action,
   remote-shell and Companion `.mjs/.d.mts` declarations added to
   `scripts/quality/check-structure.mjs` allowlist.
   The structural guard still rejects unrelated source artifacts and
   unregistered modules; do not broaden it to arbitrary `.mjs`.
2. Restored 2026-11-08/09 checkpoint links in
   `docs/checkpoints/README.md` and corrected Shizuku's relative
   checkpoint link.
3. Removed conflicting old **no-autostart** statements from root
   `AGENTS.md`; only the PocketHost admin panel has the approved
   runit exception, not all hosted services.
4. Prior source fixed runsvdir registration timing in
   `ops/termux/install-panel-services.sh` and added a negative
   regression assertion in `tests/quality/panel-autostart.test.mjs`.

### Actual S22 quality receipt, not a projected gate

The native Samsung task
`pockethost-handoff-foundation-quality-s22-20261109-v1`
finished **failed / exit 1** on exact source
`d2844917888a7b4345b361f362ec9740b2b73cf4`.
It independently ran the following stages on the isolated QA checkout:

| Gate | Native result |
| --- | --- |
| Git origin, worktree cleanliness, detached commit | PASS |
| `npm run check:structure` | **PASS** after manifest/host contract repairs |
| `npm run check:docs` | FAIL: Shizuku `AGENTS.md` lacks three required headings |
| `npm run check:boundaries` | **PASS** |
| `npm test` | **180/182 PASS**; two documentation foundation assertions failed for the same three missing Shizuku headings |
| `npm run markdownlint` | FAIL: multiple blank lines, list spacing and emphasis style in historical/current docs |
| `npm run format:check` | FAIL: **29 files** need Prettier formatting |
| `npm run lint` | FAIL: two `no-empty` catch blocks in `scripts/dev/ui-sync.mjs` |
| `npm run typecheck` | **PASS** |
| Focused panel contract | **3/3 PASS** |

After this receipt, the required `## Scope`,
`## Forbidden` and `## Gate` sections were added to
`src/modules/shizuku/AGENTS.md`. Both DEV sync catch blocks
now have explicit best-effort-cleanup comments, resolving the
identified ESLint warning without changing their operational
behavior. These repairs were **not part of the older tested SHA**.

A separate, pinned follow-up native task
`pockethost-handoff-postfix-native-gates-20261109-v1` targets
`f7eb90e9c50996e0f029acf7475793f81fabdb31`.
It reruns structure, docs, boundaries, all Node unit tests,
ESLint, TypeScript, admin lint/build and panel contract.
**Terminal result retrieved 2026-11-09:** `done`, exit `0`,
`PASS` on exact `f7eb90e9c50996e0f029acf7475793f81fabdb31`.
The isolated S22 QA checkout verified the expected Git origin,
clean pre-run worktree and exact detached SHA. Structure, docs,
boundaries, **182/182 Node tests**, ESLint, TypeScript, admin
lint/build, and **3/3 runit panel contracts** all passed.
The receipt is scoped to this SHA and those commands; it does
**not** waive Markdownlint, Prettier, coverage, all-in-one G2,
newer docs-only HEAD, or hardware tests. The 29-file formatting
debt remains a distinct review batch.

## 4. Repository and operations consistency

Main-only policy: use current `main` HEAD and compare expected SHA
before every write; no new feature branches. Existing Samsung checkouts:

- Live panel root:
  `/data/data/com.termux/files/home/Projects/PocketHost-P3-MVP-ReleaseQA-20261106`.
  Its Vite process is **runit-owned**, so do not use old manual
  stop/start or stale-owner scripts against it.
- Isolated QA:
  `/data/data/com.termux/files/home/Projects/PocketHost-H3-QA-20261107`.
  Detached exact commit testing is allowed, not a development branch.
- Runit definitions:
  `$PREFIX/var/service/pockethost-panel` and
  `$PREFIX/var/service/pockethost-panel-watch`.
  Their `down` markers are absent when enabled; startup depends on
  Termux service-daemon/runsvdir and Android allowing Termux to run.
- Existing Companion loopback fixed service:
  `127.0.0.1:18791` only when authorized and active.
  Do not confuse Android backend availability with panel HTTP health.
- Admin private LAN `18878`, site preview `18879`;
  no wildcard `0.0.0.0`, no WAN or public router forwarding.
  The owner-private admin is currently **unauthenticated HTTP**.
  Powerful Shizuku shell should not be assumed safe on untrusted Wi-Fi.

**Self-healing is layered**, not duplicated:
`runit` restores the PocketHost process;
panel watchdog probes local HTTP with grace/threshold/cooldown;
the already running PocketHost Vite restores its own private LAN
gateway when Wi-Fi returns. A reboot does not imply Android will
permit background service start after a manual force-stop.

## 5. Remaining risks, ranked and closed-vs-open decisions

**P0 / first action next chat:**
1. Read fresh `PocketHost/main`, actual live and QA HEADs,
   git cleanliness, `sv status` for the two PocketHost services,
   two HTTP endpoints from S22 **and Mac**, plus six protected
   service states; report **current** not historic live truth.
2. Read the pending `pockethost-handoff-foundation-quality-s22-20261109-v1`
   result. Do not recreate it if already completed.
3. Run one new exact-`main` Samsung G0/G1/G2 matrix only if needed
   after taking the current HEAD and confirming QA checkout isn't
   serving the live panel. Fix any remaining structure, documentation,
   prettier, lint, type, coverage or admin build failures without
   weakening checks; update proof and checkpoint.
4. Confirm the source/installed state of the latest runsvdir race fix;
   do not blindly overwrite the live code. Make rollback source,
   owner marker PID/start ticks and service states explicit.

**P1 / before reliability closure:**
5. Test owner-specific local HTTP watchdog fault and cooldown without
   disrupting external services; then **full phone reboot / Termux:Boot**
   and late-Wi-Fi startup (scheduled with the user if needed).
6. Test browser pages and legitimate positive/negative Shizuku
   operations against **exact installed Companion**, not source alone.
   Do not mutate unrelated Android apps, phone settings or processes.
7. Close historical independent Restic/ttyd/browser release holds only
   in their own scoped sprints if still relevant.

**Next product sprint (M0 then M1/M2/M3):**
8. Audit and decouple IleStoi/PhotoMap hard-coded UI/backend
   integrations while preserving active sites/data/tunnels.
9. Implement minimal registries and `components[]` on the existing
   H2 runtime, one shared ownership/health/recovery contract.
10. Deliver one user-created, disposable **Node.js Hosting MVP**
    with pinned dependencies, readiness, release and rollback. Add
    SSH/Cloudflare/Python modules in M4, full orchestration in M5;
    no automatic migration of existing external workloads.

No current evidence authorizes external service migration, live
production backup edits, global OS package updates, or exposing the
LAN admin/shell outside the private network.

## 6. Next-chat reading order / handoff contract

1. `AGENTS.md` and `docs/LOCAL_AGENT_TERMUX.md`.
2. `docs/HANDOFF_NEXT_CHAT.md` (newest top section).
3. This checkpoint and
   [panel acceptance checkpoint](2026-11-09-panel-runit-self-healing.md).
4. `docs/QUALITY_GATES.md`,
   `docs/ROADMAP.md`,
   `docs/DEVELOPMENT_PLAN.md`,
   `docs/MODULES.md`,
   `docs/TARGET_INFORMATION_ARCHITECTURE.md`,
   `docs/ARCHITECTURE.md`.
5. Latest native task receipts, not a previous chat's claimed status.

Start with **preflight and one closable P0 quality/reliability task**,
not a new architectural debate. Maintain main-only and six-service
isolation. Record exact-SHA output, close each task distinctly and
update this checkpoint/handoff after a proven result.
