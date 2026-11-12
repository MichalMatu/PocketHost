# PocketHost — Agent Contract

## CRITICAL: FAST FLOW FIRST

**MANDATORY:** One coherent change → one focused Samsung check → HMR/owner review.
Select checks by changed paths, never an automatic whole-repo audit.
Reuse prior exact-SHA PASS for unchanged scope; skipped checks are not PASS.

1. UI changes → affected Vitest interactions; backend changes → relevant
   positive and negative tests; CSS/copy → HMR and owner review; docs → docs check.
   Unmapped/high-risk changes require manual review, not an invented PASS.
2. Admin ESLint is not a routine DEV gate. Run periodically when useful,
   on explicit request or at release; full G2 retains it.
3. On failure, make one concrete fix and rerun only the affected check.
   Collect stdout and stderr once; do not guess formatter output. Avoid
   repetitive QA, formatting, audits and documentation loops.
4. Prefer existing Vite HMR; if restart is necessary, verify owner/PID/start
   ticks, exact working directory, rollback and protected services.
5. Read pending Local Agent results once per turn; no duplicates or busy
   polling. Published task is not a terminal PASS. Missing receipt is HOLD.
6. Commit source before docs polish; a GitHub commit does not update the
   phone. Never block owner-requested DEV refresh on unrelated cosmetic gates.

See docs/DEV_ITERATION.md for exact rules, caching and prior QA incidents.

## Read scope and context budget

This file applies repository-wide; nested AGENTS.md files add local rules.
At session start read **this file, docs/START_HERE.md, and only the
AGENTS.md nearest changed paths**. Verify the fresh main HEAD. Read
docs/LOCAL_AGENT_TERMUX.md before host tasks; open architecture, module,
security, QA or historical documents **only when relevant**. Do not preload
docs/HANDOFF_NEXT_CHAT.md, docs/QUALITY_GATES.md, the roadmap or the
checkpoint archive into every chat. Their evidence remains available by link.
Prefer file paths, exact SHA, short excerpts and terminal summaries over
transcripts, duplicated status reports and entire source trees.

## Source and execution

- **Main only.** Commit PocketHost code, docs, tests and tooling directly to
  the current main; no work branch/PR unless the owner explicitly permits
  it. Re-read HEAD before writes; use non-force, expected-HEAD updates.
- **Termux Local Agent only.** All PocketHost development commands,
  dependency installs, test runs, linting, builds and compilation run
  exclusively on the exact verified Samsung Termux through its installed
  Local Agent. GitHub Connector handles source and private task transport;
  it is not a host executor. Never use Mac, ChatGPT Linux sandbox, Codex,
  ChatGPT Work or GitHub Actions for these operations (including status).
- The Agent uses bounded **host-command tasks** with verified host and
  installation identities; PocketHost project binding is unnecessary.
  Inspect existing pending results before submitting a duplicate task.
  A published task is not a PASS: obtain its terminal result, code and SHA.
- Use a clean isolated PocketHost checkout, never the Local Agent, IleStoi.pl
  or another service's working directory. Do not guess host IDs, checkout
  paths, capabilities or physical test results.
- No package install, global upgrade, dependency resolution, service
  restart or second environment merely to run routine checks. Keep npm
  cache and unchanged node_modules between sessions; install with the
  **verified** lockfile only when missing or changed, on the phone.

## Optional graph tooling

Optional only, never substitute for Samsung evidence. No automatic global
init, scans, watch mode or Mac tooling.

## FAST FLOW — proportional checks and caching

Fresh main → edit → commit → compare with last verified SHA → smallest
Samsung check → DEV HMR → owner review. Preview changed checks with
`npm run dev:changed -- --base=<last-verified-sha>`; execute `--run`
only via exact verified Samsung Termux Local Agent. Tests-only changes
do not trigger blanket gates; docs-only changes need no restart or build.
Preserve npm, Vite and TypeScript caches. No routine admin lint or full
release gates for minor edits. A DEV sync is not a G3 physical PASS.
See docs/DEV_ITERATION.md and docs/LOCAL_AGENT_TERMUX.md.

## Product and privilege boundaries

**Active product order (ROADMAP):** first finish Basic Node.js Hosting
and GitHub deploy; then Hosting panel Cloudflare/SSH, per-site web
traffic analytics and backup. Basic is fully operational on official
Termux without Companion/Shizuku. Pro denotes extra Android-app
dependencies, not billing. Companion/Shizuku and the unified APK
are frozen/deferred for this sprint. Do not reorder the menu or
change existing Pro code. Historical Android plans are not active
instructions; refer to docs/ROADMAP.md.

PocketHost is a **DEV-only**, owner-operated Android/Termux management
console. Shizuku is a first-class power-user integration; expose real
authorized ADB/native capabilities and explicit Advanced Shell execution
without artificial command allowlists, pairing rituals or repeated approval
dialogs in the existing trusted private-LAN DEV panel. A direct user Run is
intent, but ADB is **not root**. Show real errors; never fabricate privileges.
The browser cannot acquire Binder privileges without an Android companion.
See ADR-0013 and docs/modules/shizuku.md.

Functional development precedes optional user-facing security-hardening
work, **not** underlying host/process/network safeguards. Never silently
execute commands, escalate privileges, leak secrets, enable WAN, add
wild-card listeners or present unauthenticated HTTP shell as secure.
Keep Companion on Android loopback; restrict the owner-approved LAN
gateway to its exact private IPv4 interface. Authorization/TLS must
remain technically possible later.

## Protected host operations

- Treat every discovered process/site as **external**, regardless of its
  name/port, until an explicit PocketHost ownership record proves otherwise.
  Never modify, stop, start, restart, rebind, migrate or adopt IleStoi.pl,
  PhotoMap, Local Agent, or any unrelated Termux service or data.
- No unscoped filesystem scans, automatic package installation, tunnels,
  DNS changes, process killing, boot receiver, new supervisor or public
  service exposure. Only the owner-approved **PocketHost DEV panel**
  may use existing Termux runit autostart and bounded recovery (ADR-0014).
  This never authorizes hosted project or foreign-service autostart.
- An owner-approved refresh/restart of the **existing** PocketHost DEV
  panel is permitted after verifying exact ownership, PID/start ticks,
  working directory and rollback SHA. Prefer Vite HMR without restart.
  Do not infer ownership from port, process name or PID alone.
- GitHub-to-Samsung dev:sync is manually opt-in, once per DEV session,
  and only auto-syncs approved UI/docs paths from a clean checkout.
  It never installs, tests, starts or kills services. Backend/config
  changes require manual review. See scripts/dev/ui-sync-policy.mjs.

## Architecture and quality evidence

Modules communicate through typed shared contracts; host owns
Termux process/filesystem operations. UI, inventory, runtime, packages,
sites, config, diagnostics, observability and AI are separated. Do not
import another module's internals or shell out from the UI.

Keep upstream admin routes/screens and upstream notices intact. Use the
nearest scoped AGENTS.md and applicable ADR/module docs. For changes to
host commands, filesystem boundaries, ownership, network, persistence,
package actions and security, select focused positive **and negative**
native tests; escalate to larger QA when risk actually warrants it.

A DEV HMR update is not a public/product release or physical G3 PASS.
Record exact SHA, command, terminal status and skipped checks; distinguish
UNVERIFIED from PASS. Never commit secrets or private Agent identifiers.
Public releases retain independently scoped G1/G2/G3 and device gates.
